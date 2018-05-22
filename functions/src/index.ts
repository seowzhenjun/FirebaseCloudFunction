import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();
import * as async from 'async';
import * as nodemailer from 'nodemailer';

import * as interfaces from './interfaces';
import * as GmailAPI from './GmailAPI';
import { refreshtoken } from './oAuth2';
import { sendToDevice } from './FCM';

const db = admin.database();
const gmailSubRef = db.ref("GmailSub");
const recentMsgRef = db.ref('RecentMsg');
const topic = 'gmail-push-notification';
const version = "0.1 (beta)";

/* Cloud function that accept historyId from Google Pub/Sub, retrieve the previous user's historyId,
   and replace it with the current one, and checks for any new email from user inbox,
   and sends it to user's as push notifications */
export const pubSubTrigger = functions.pubsub.topic(topic).onPublish((change, context) => {
    const messageBody = change ? Buffer.from(change.data, 'base64').toString() : null;
    const keydata = JSON.parse(messageBody);
    const historyId = keydata.historyId;
    const userId = keydata.emailAddress;
    let key,access_Token;
    
    // Fetch startHistoryId and accessToken from db
    return gmailSubRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
        let startHistoryId, refreshToken, regToken;
        const regTokenArr = [];

        key = Object.keys(snapshot.val())[0]; // To get the unique key

        snapshot.forEach(function(childSnapshot){
            startHistoryId  = childSnapshot.val().historyId;
            refreshToken    = childSnapshot.val().refreshToken;
            regToken        = childSnapshot.val().regToken;
        })

        for (const k in regToken){
            regTokenArr.push(k);
        }
        // Flow of async Gmail REST calls to make sure they run in order
        async.waterfall([
            function(callback){
                refreshtoken(refreshToken, callback);
            },
            function(accessToken,callback){
                access_Token = accessToken;
                GmailAPI.historyList(userId, startHistoryId, accessToken, callback);
            },
            function(msgId,callback){
                GmailAPI.getMsg(userId, access_Token, msgId, callback);
            },
            function(notification, important, callback){
                if(important){
                    sendToDevice(userId, notification, regTokenArr, callback);
                }
            }
        ],function(err, result){
            if(err) return (err);
        });
    }).then(() => {
        db.ref(`GmailSub/${key}`).update({
            historyId : historyId
        })
        .catch(err => console.log(err));
    }).catch(error => {
        console.log("pubsubTrigger err : " + error);
    })

});

/* Cloud function to subscribe new user to Google Pub/Sub topic*/
export const subscribe = functions.database.ref('/GmailSub/{newUser}').onCreate((snap, context)=>{
    const key = snap.key;
    const userName = snap.val().userName;
    const refreshToken = snap.val().refreshToken;

    // Flow of async Gmail REST calls to make sure they run in order
    return async.waterfall([
        function(callback){
            refreshtoken(refreshToken, callback);
        },
        function(accessToken,callback){
            GmailAPI.watch(userName,accessToken,key,callback);
        }
    ],function(err, result){
        if(err) return (err);
    });
});


/* Cloud function to register new users to Firebase database */
export const addData = functions.https.onRequest((req,res) =>{
    const body = req.body;
    gmailSubRef.orderByChild("userName").equalTo(body.name).once("value", snapshot => {
        if(snapshot.val() !== null){
            const key = Object.keys(snapshot.val())[0]; // To get the unique key
            const regTokenref = db.ref(`GmailSub/${key}/regToken`);
            const regToken = body.regToken;
            db.ref(`GmailSub/${key}`).update({
                refreshToken : body.refreshToken
            })
            .catch(err => console.log(err));

            regTokenref.orderByKey().equalTo(regToken).once("value" , snapShot => {
                if(snapShot.val() === null){
                    regTokenref.update({
                        [regToken] : true
                    })
                    .catch(err => console.log(err));
                }
            }).catch(err =>{
                console.log("error when checking if regToken exist : " + err);
            })
        }
        else{
            gmailSubRef.push().set({
                userName    : body.name,
                regToken    : {[body.regToken] : true},
                refreshToken: body.refreshToken  
            })
            .catch(err => console.log(err));
        }
            res.send('done');
    })
    .catch(err => console.log(err));
})

/* Invoke watch() request for all users in database once everyday at 8am.
   This is done automatically by cron-job */
export const scheduleWatch = functions.https.onRequest((req,res) => {
    const tokenArr = [];
    
    // Retrieve email address and refresh token of every user in database,
    // and store them in an array as JSON
    gmailSubRef.orderByChild("refreshToken").once("value", snapshot => {
        snapshot.forEach(snap => {
            const user : interfaces.userData = {
                refreshToken : snap.val().refreshToken,
                userName     : snap.val().userName,
                key          : snap.key
            };
            tokenArr.push(user);
            return false;
        })
    })
    .then(() => {
        tokenArr.forEach((token) =>{
            // Flow of async Gmail REST calls to make sure they run in order
            async.waterfall([
                function(callback){
                    refreshtoken(token.refreshToken, callback);
                },
                function(accessToken,callback){
                    GmailAPI.watch(token.userName,accessToken,token.key,callback);
                }
            ],function(err, result){
                if(err) return (err);
            });
        })
    })
    .catch(err =>{
        console.log(err);
    })
    res.end();
})

/* Remove regToken of logged out user from database */
export const unsubscribe = functions.https.onRequest((req,res) => {
    const body = req.body;

    gmailSubRef.orderByChild("userName/").equalTo(body.name).once("value", snapshot => {
        if(snapshot.val() !== null){
            const key = Object.keys(snapshot.val())[0]; // To get the unique key
            const regTokenref = db.ref(`GmailSub/${key}/regToken`);
            const regToken = body.regToken;

            regTokenref.orderByKey().equalTo(regToken).once("value" , snapShot => {
                if(snapShot.val() !== null){
                    regTokenref.update({
                        [regToken] : null
                    })
                    .catch(err => console.log(err));
                }
            }).catch(err =>{
                console.log("error when checking if regToken exist : " + err);
            })
        }
            res.end();
    })
    .catch(err => console.log(err));
})

export const sendFeedBack = functions.https.onRequest((req,res)=>{
    const body = req.body;
    let text ='';
    //This is the transporter to send the email
    const transporter = nodemailer.createTransport({
        service : 'gmail',
        auth: {
            user: 'moodletracker.feedback@gmail.com',
            pass : 'moodleTRACKER2018'
        }
    });

    if(!body.body.anonymous){
        text+=`From : ${body.body.userName} (${body.body.email})\n`;
    }
    else{
        text += 'From : Anonymous user\n';
    }
    switch(body.body.feedbackType){
        case 'bug' :
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\nBug type : ${body.body.bugType}\nSeverity : ${body.body.severity}\nDescription : ${body.body.description}`;
        break;
        case 'feedback' :
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\n\nSet up rating : ${body.body.setUpRating}/5\nTutorial rating : ${body.body.tutorialRating}/5\nSuggested keywords accuracy rating : ${body.body.suggestedKeywordRating}/5\nNotifications accuracy rating : ${body.body.notificationRating}/5\nOverall rating : ${body.body.overallRating}/5\n\nComment : ${body.body.description}`;
        break;
        default:
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\nDescription : ${body.body.description}`;
        break;

    }
    //This is the details of the mail where a long motion is detected
    const testMail = {
        from: 'moodletracker.feedback@gmail.com',
        to: 'moodletracker.feedback@gmail.com',
        subject: 'Feedback from Moodle Announcement Tracker',
        text: text
    };

    transporter.sendMail(testMail, function(error, info){    //then sends an email
        if (error) {
            console.log(error);
            res.send({response:'error'});
        } else {
            console.log('Email sent: ' + info.response);    //notify that an email is sent successfully
            res.send({response :'success'});
        }
    });
})


export const clearRecentMsg = functions.https.onRequest((req,res)=>{
    recentMsgRef.once("value", snapShot =>{
        snapShot.forEach(childSnapshot=>{
            childSnapshot.forEach(snap=>{
                if(snap.key !== "userName"){
                    const ref = recentMsgRef.child(`${childSnapshot.key}/${snap.key}`);
                    ref.remove().catch(err=>console.log(err));
                }
                return false;
            })
            return false;
        })
    }).then(()=>{
        res.end();
    }).catch(err=>{
        console.log(err);
    })
})