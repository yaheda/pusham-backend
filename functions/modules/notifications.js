const admin = require('firebase-admin');
//const { serverTimestamp } = require('firebase/firestore')
const { getFirestore, FieldValue, Timestamp, Filter } = require('firebase-admin/firestore');
const logger = require("firebase-functions/logger");

const triggerPushNotifications = async (notification) => {
  const notificationsRef = await admin.firestore()
    .collection('ff_push_notifications')
    .add({
      initial_page_name: 'HomePage',
      notification_sound: 'default',
      //...notification
      notification_text: notification.notification_text,
      notification_title: notification.notification_title,
      num_sent: 0,
      parameterData: {},
      status: 'started',
      target_audience: 'All',
      timestamp: FieldValue == undefined ? Timestamp.now() : FieldValue.serverTimestamp(),
      user_refs: notification.user_refs,
    });
}

module.exports = {
  triggerPushNotifications
}