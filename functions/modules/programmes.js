const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const crypto = require('crypto');
const axios = require('axios')
const admin = require('firebase-admin');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");

const eneoProgrammeEndpoint = 'https://alert.eneo.cm/ajaxOutage.php';


async function fetchProgrammes(region) {
  var formdata = new FormData();
  formdata.append('region', region);
  const { data } = await axios.post(eneoProgrammeEndpoint, formdata);
  return data;
  //return sampleData;
}

const formatDate = (date, time) => {
  const time_component = time.split('H');
  const hour = time_component[0];
  const minute = time_component[1];
  const timezone = '+01:00'

  const result = new Date(`${date}T${hour}:${minute}:00.000${timezone}`);
  return result;
} 

const programmeAlreadyExist = ({ prog_date, prog_heure_debut, prog_heure_fin }) => {
  const prog_date_begin = formatDate(prog_date, prog_heure_debut);
  const prog_date_end = formatDate(prog_date, prog_heure_fin);
}

const mapToProgrammeDocument = ({ prog_date, prog_heure_debut, prog_heure_fin, observations }) => {
  const prog_date_begin = formatDate(prog_date, prog_heure_debut);
  const prog_date_end = formatDate(prog_date, prog_heure_fin);

  return {
    observations: observations.toSentenceCase(),
    prog_date: Timestamp.fromDate(prog_date_begin),
    prog_date_end: Timestamp.fromDate(prog_date_end),
  }
}

const mapToAreaDocument = ({ ville, quartier, region }) => {
  return {
    ville: ville.toSentenceCase().trim(),
    region: region.toSentenceCase().trim(),
    quartier: quartier.toSentenceCase().trim()
  }
}

String.prototype.toSentenceCase = function() {
  return this.toLocaleLowerCase().replace(/\.\s+([a-z])[^\.]|^(\s*[a-z])[^\.]/g, s => s.replace(/([a-z])/,s => s.toUpperCase()));
}

const processArea = async (programme) => {
  const snapshot = await admin.firestore()
    .collection('areas')
    .where('quartier', '==', programme.quartier.toSentenceCase().trim())
    .where('ville', '==', programme.ville.toSentenceCase().trim())
    .where('region', '==', programme.region.toSentenceCase().trim())
    .get()
  
  var id;
  if (snapshot.empty) {
    const areaDocument = await addArea(programme);
    id = areaDocument.id;
  } else {
    id = snapshot.docs[0].id
  }

  return id;
}

const addArea = async (programme) => {
  return await admin.firestore()
  .collection('areas')
  .add(mapToAreaDocument(programme))
}

const updateProgramme = async (areaId, programme) => {
  const progId = createProgrammeId(programme);
  const programmeRef = admin.firestore()
    .collection('areas')
    .doc(areaId)
    .collection('programmes')
    .doc(progId);

  const doc = await programmeRef.get();
  
  if (doc.exists) {
    return;
  }
  
  const programmeDocument = mapToProgrammeDocument(programme);
  
  await programmeRef.set(programmeDocument)
}

const createProgrammeId = ({ quartier, observations, prog_date, prog_heure_debut, prog_heure_fin }) => {
  const value = quartier + observations + prog_date + prog_heure_debut + prog_heure_fin;
  return crypto.createHash('sha1').update(value).digest('hex');
}

const processProgramme = async (region) => {
  const programmes = await fetchProgrammes(region);
  for (let programme of programmes.data) {
    const areaId = await processArea(programme);
    await updateProgramme(areaId, programme);
  };
  return programmes;
}

const processNotifications = async () => {
  const snapshot = await admin.firestore()
    .collection('users')
    .where('quartier', '!=', null)
    .get()
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log(doc.id, " => ", doc.data());
  });
}

module.exports = {
  processProgramme
}