/********************************************************************************************
 * This is the entry file for all the functions                                             *
 * All Cloud functions should be declared here                                              *
 * Logic for each Cloud function should be written in another ts file                       *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

import * as subscribeHandler from './subscribe';
import * as clearRecentMsgHandler from './clearRecentMsg';
import * as scheduleWatchHandler from './scheduleWatch';
import * as unsubscribeHandler from './unsubscribe';
import * as addDataHandler from './addData';
import * as sendFeedBackHandler from './sendFeedBack';
import * as pubSubTriggerHandler from './pubSubTrigger';

const topic = 'gmail-push-notification';

export const pubSubTrigger = functions.pubsub.topic(topic).onPublish((change, context) => {
    pubSubTriggerHandler.pubSubTrigger(change,context);
});

export const subscribe = functions.database.ref('/GmailSub/{newUser}').onCreate((snap, context)=>{
    subscribeHandler.subscribe(snap, context);
});

export const addData = functions.https.onRequest((req,res) =>{
    addDataHandler.addData(req,res);
});

export const scheduleWatch = functions.https.onRequest((req,res) => {
    scheduleWatchHandler.scheduleWatch(req,res);
});

export const unsubscribe = functions.https.onRequest((req,res) => {
    unsubscribeHandler.unsubscribe(req,res);
});

export const sendFeedBack = functions.https.onRequest((req,res)=>{
    sendFeedBackHandler.sendFeedBack(req,res);
});

export const clearRecentMsg = functions.https.onRequest((req,res)=>{
    clearRecentMsgHandler.clearRecentMsg(req,res);
})