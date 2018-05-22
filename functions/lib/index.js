"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const subscribeHandler = require("./subscribe");
const clearRecentMsgHandler = require("./clearRecentMsg");
const scheduleWatchHandler = require("./scheduleWatch");
const unsubscribeHandler = require("./unsubscribe");
const addDataHandler = require("./addData");
const sendFeedBackHandler = require("./sendFeedBack");
const pubSubTriggerHandler = require("./pubSubTrigger");
const topic = 'gmail-push-notification';
exports.pubSubTrigger = functions.pubsub.topic(topic).onPublish((change, context) => {
    pubSubTriggerHandler.pubSubTrigger(change, context);
});
exports.subscribe = functions.database.ref('/GmailSub/{newUser}').onCreate((snap, context) => {
    subscribeHandler.subscribe(snap, context);
});
exports.addData = functions.https.onRequest((req, res) => {
    addDataHandler.addData(req, res);
});
exports.scheduleWatch = functions.https.onRequest((req, res) => {
    scheduleWatchHandler.scheduleWatch(req, res);
});
exports.unsubscribe = functions.https.onRequest((req, res) => {
    unsubscribeHandler.unsubscribe(req, res);
});
exports.sendFeedBack = functions.https.onRequest((req, res) => {
    sendFeedBackHandler.sendFeedBack(req, res);
});
exports.clearRecentMsg = functions.https.onRequest((req, res) => {
    clearRecentMsgHandler.clearRecentMsg(req, res);
});
//# sourceMappingURL=index.js.map