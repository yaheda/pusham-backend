/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const crypto = require('crypto');
const axios = require('axios')
const admin = require('firebase-admin');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");

admin.initializeApp();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

const generalOpts = {
  region: 'europe-west3'
}

exports.helloCustom1 = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello1 from Firebase Custom1 Backend1!");
});

const REGIONS = {
  'Yaounde': 'X-1',
  'Douala': 'X-22',
  'SudOuest': '10',
  'Sud': '9',
  'NordOuest': '8',
  'Nord': '7',
  'Ouest': '6',
  'Littoral': '5',
  'ExtremeNord': '4',
  'Est': '3',
  'Centre': '2',
  'Adamaoua': '1'
}


// const sampleData = {
//   "status": 1,
//   "data": [
//     {
//       "observations": "TRAVAUX D'ENTRETIEN D'UN POSTE DE DISTRIBUTION",
//       "prog_date": "2024-03-09",
//       "prog_heure_debut": "06H30",
//       "prog_heure_fin": "18H30",
//       "region": "LITTORAL",
//       "ville": "DOUALA",
//       "quartier": "LOGBABABA "
//     },
//     {
//       "observations": "TRAVAUX D'ENTRETIEN D'UN POSTE DE DISTRIBUTION",
//       "prog_date": "2024-03-09",
//       "prog_heure_debut": "06H30",
//       "prog_heure_fin": "18H30",
//       "region": "LITTORAL",
//       "ville": "DOUALA",
//       "quartier": "BILONGUE "
//     },
//     {
//       "observations": "TRAVAUX D'ENTRETIEN D'UN POSTE DE DISTRIBUTION",
//       "prog_date": "2024-03-09",
//       "prog_heure_debut": "06H30",
//       "prog_heure_fin": "18H30",
//       "region": "LITTORAL",
//       "ville": "DOUALA",
//       "quartier": " DIBOUM "
//     },
//   ]
// }

const { processProgramme } = require('./modules/programmes')
//ogger.info("BEGIN - fetchDouala", {structuredData: true});

exports.fetchRegion = onRequest({...generalOpts, timeoutSeconds: 300}, async (request, response) => {
  const region = request.query.region;
  logger.info(`BEGIN - fetch ${region}`);
  try {
    const programmes = await processProgramme(REGIONS[region]);
    logger.log(programmes);
    response.send(programmes);
  } catch (error) {
    logger.error(error);
    throw new functions.https.HttpsError("Error", error);
  }
  logger.info(`END - fetch ${region}`);
});


// exports.testSchedules = onSchedule("1 * * * *", async (event) => {
//   logger.log("loadDoualaSchedules ran....");
//   logger.debug('azbi');
// });

// exports.testSchedules1 = onSchedule("1 * * * *", async (event) => {
//   logger.log("loadDoualaSchedules111 ran....");
//   logger.debug('azbi1111');
// });

// exports.testSchedules2 = functions.pubsub.schedule(`every 1 minutes synchronized`).onRun(async (_) => {
//   logger.log("testSchedules2 ran....");
//   logger.debug('raann222');
// });
