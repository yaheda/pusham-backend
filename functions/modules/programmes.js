const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const crypto = require('crypto');
const axios = require('axios')
const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp, Filter } = require('firebase-admin/firestore');
//const { serverTimestamp } = require('firebase/firestore')
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");
const moment = require("moment");
const eneoProgrammeEndpoint = 'https://alert.eneo.cm/ajaxOutage.php';
const { triggerPushNotifications } = require('./notifications')

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
  const minute = time_component[1].replace(':', '');;
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

  logger.log('prog_date_begin- ' + prog_date_begin);
  logger.log('prog_date_end - ' + prog_date_end);
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
  logger.log('Process Area: ' + programme.quartier.toSentenceCase().trim());
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
  logger.log('MapToProgramme: ' + programme)
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

const triggerNotifications = async () => {
  const currentDate = new Date();
  const currentTimestamp = Timestamp.fromDate(currentDate);

  const tresholdDate = moment(currentDate).add(1, 'hours');
  const tresholdTimestamp = Timestamp.fromDate(tresholdDate.toDate());

  const programmes = await admin.firestore()
    .collectionGroup('programmes')
    .where('prog_date', '>', currentTimestamp)
    .where('prog_date', '<=', tresholdTimestamp)
    .get();

  const areas = [];
  for (let i = 0; i < programmes.size; i++) {
    var doc = programmes.docs[i];
    var programme = doc.data();

    //const areaDoc = doc.ref.parent.parent;
    const areaId = doc.ref.parent.parent.id;
    const areaDocRef = admin.firestore()
      .collection('areas')
      .doc(areaId);
    

    logger.log('Area: ' + areaId);
    const quartiers = await admin.firestore()
      .collectionGroup('quartiers')
      .where('area', '==', areaDocRef)
      .get();

    //logger.log(users);

    logger.log('Quartier Size: ' + quartiers.size);

    if (quartiers.size == 0) {
      return;
    }

    const users = [];
    quartiers.forEach(doc => {
      //const data = doc.data();
      const userId = doc.ref.parent.parent.id;
      users.push('/users/' + userId);
    })

    logger.log('Users: ' + users.join(','))

    const area = await areaDocRef.get();
    const areaData = area.data();

    const prog_date_time = moment(programme.prog_date.toDate()).format('HH:mm');
    const prog_date_end_time = moment(programme.prog_date_end.toDate()).format('HH:mm');

    await triggerPushNotifications({
      notification_text: programme.observations,
      notification_title: areaData.quartier + ' Service de ' + prog_date_time + ' a ' +  prog_date_end_time,
      user_refs: users.join(',')
    })

    // const area = areaDocRef.get();

    // const prog_date_time = moment(programme.prog_date).format('HH:mm');
    // const prog_date_end_time = moment(programme.prog_date_end).format('HH:mm');;

    // await admin.firestore()
    // .collection('ff_push_notifications')
    // .add({
    //   initial_page_name: "HomePage",
    //   notification_sound: "default"
    //   notification_text: programme.observations,
    //   notification_title: area.quartier + ' Service de' + prog_date_time + ' a ' +  prog_date_end_time
    //   num_sent
    //   parameter_data
    //   status
    //   target_audience
    //   timestamp
    //   user_refs
    // })


    
    //areas.push(areaId);
  }
  //logger.log('Areas: ' + areas);

  // const users = await admin.firestore()
  //   .collectionGroup('quartiers')
  //   .where('area', 'in', areas);
  
  // console.log('Quartier Size2: ' + users.size);

  // programmes.forEach(doc => {
  //   const data = doc.data();
  //   const areaId = doc.ref.parent.parent.id;

  //   /// fetch users subscribed to this area


  //   const d1 = 0;
  // })
  
  const x = 2;
  

  // const snapshot = await admin.firestore()
  //   .collection('users')
  //   .where('quartier', '!=', null)
  //   .get()
  
  // snapshot.forEach((doc) => {
  //   const data = doc.data();
  //   console.log(doc.id, " => ", doc.data());
  // });
}

const clearOldProgrammes = async () => {
  const currentDate = new Date();
  const tresholdDate = moment(currentDate).subtract(10, 'days');
  const tresholdTimestamp = Timestamp.fromDate(tresholdDate.toDate());
  logger.log('Threshold - ' + tresholdDate);
  
  const programmes = await admin.firestore()
    .collectionGroup('programmes')
    .where('prog_date', '<', tresholdTimestamp)
    .get();

  logger.log('Programmes clear size: ' + programmes.size);
  if (programmes.size == 0) {
    logger.log('Nothing to clear');
    return;
  }

  const batch = admin.firestore().batch();
  programmes.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  logger.log('Old programmes cleared')
}

const getProgrammes = async (quartier, ville) => {
  const areas = await admin.firestore()
    .collection('areas')
    //.where('ville', '==', 'Douala')
    .where('ville', '==', ville)
    .where('quartier', '==', quartier)
    .get();

  const areasRef = admin.firestore().collection('areas');
  
  const areaDoc = areas.docs[0];

  //const area = areas.docs[0].data();
  //logger.log(area);

  if (!areaDoc) {
    return [];
  }

  const areaId = areaDoc.id;

  //logger.log('AreaID: ' + areaId);

  const programmes = await areasRef.doc(areaId).collection('programmes').get();

  const results = [];
  programmes.docs.forEach((doc) => {
    const programme = doc.data();
    
    const prog_day = moment(programme.prog_date.toDate()).format('MMMM Do YYYY');
    const prog_date_time = moment(programme.prog_date.toDate()).format('HH:mm');
    const prog_date_end_time = moment(programme.prog_date_end.toDate()).format('HH:mm');

    const message = `${programme.observations} - ${prog_day} from ${prog_date_time} to ${prog_date_end_time}`;

    const prog = {
      message,
      ...programme
    }
    results.push(prog);
    //logger.log(doc.data());
  });

  return results;
  
}

const getProgrammeSummary = (programmes) => {
  if (programmes.length == 0) {
    return 'No planned outage';
  }

  let schedule = '';
  programmes.forEach((proggramme) => {
    schedule += `${proggramme.message}. `
  })

  return schedule;
}

module.exports = {
  processProgramme,
  triggerNotifications,
  clearOldProgrammes,

  getProgrammes,
  getProgrammeSummary
}