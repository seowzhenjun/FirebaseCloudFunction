import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as rp from 'request-promise';
import * as async from 'async';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

const clientID = '';
const clientSecret = '';
const db = admin.database();
const gmailSubRef = db.ref("GmailSub");
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
                historyList(userId, startHistoryId, accessToken, callback);
            },
            function(msgId,callback){
                getMsg(userId, access_Token, msgId, callback);
            },
            function(notification, important, callback){
                if(important){
                    sendToDevice(notification, regTokenArr, callback);
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
            watch(userName,accessToken,key,callback);
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
            const user : userData = {
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
                    watch(token.userName,accessToken,token.key,callback);
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
            pass : ''
        }
    });

    if(!body.body.anonymous){
        text+=`From : ${body.body.userName} (${body.body.email})\n`;
    }
    switch(body.body.feedbackType){
        case 'bug' :
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\nBug type : ${body.body.bugType}\nSeverity : ${body.body.severity}\nDescription : ${body.body.description}`;
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
          res.status(400).end();
        } else {
          console.log('Email sent: ' + info.response);    //notify that an email is sent successfully
            res.status(200).end();
        }
    });
})

export interface userData{
    userName : string;
    refreshToken : string;
    key : string;
}

function refreshtoken(refreshToken,callback){
    const postOptions = { 
        method: 'POST',
        url: 'https://www.googleapis.com/oauth2/v4/token',
        headers: { 
            'Content-Type' : 'application/x-www-form-urlencoded' 
        },
        form: { 
            client_id       : clientID,
            client_secret   : clientSecret,
            refresh_token   : refreshToken,
            grant_type      : 'refresh_token'
        },
        json : true
    };

    rp(postOptions).then(body =>{
        if(callback !== 1){
            callback(null,body.access_token);
        }
    }).catch(err => {
        console.log("refreshToken error : " + err);
    })
}

function historyList(userId, historyId, accessToken, callback){
    
    const options = { 
        method: 'GET',
        url: `https://www.googleapis.com/gmail/v1/users/${userId}/history`,
        qs: { 
            startHistoryId  : historyId, 
            historyTypes    : ['messageAdded','labelsAdded'],
            maxResult       : 1
        },
        headers: {
            'Authorization' : `Bearer ${accessToken}`
        }
    };

    rp(options).then(body =>{
        const msg = JSON.parse(body).history;
        let msgId;
        // Trigger when there is new email or an email is deleted from user's inbox
        if (msg !== null){
            msg.forEach(function(message){
                if(JSON.stringify(message.messagesAdded) !== undefined ){
                    const msgAdded = message.messagesAdded;
                    msgAdded.forEach(function(result){
                        msgId = result.message.id;
                    })
                    callback(null,msgId);
                }
                if(JSON.stringify(message.labelsAdded) !== undefined){
                    const labelAdded = message.labelsAdded;
                    labelAdded.forEach(label=>{
                        if(label.labelIds[0] === 'TRASH'){
                            addImportantMsg(userId,label.message.id,null);
                        }
                    })
                }
            })
        }
    }).catch(err => {
        console.log("historyList error : " + err);
    })
}

function getMsg(userId,accessToken,msgId,callback){
    const notification = {
        title       : "",
        snippet     : "",
        messageID   : "",
        payload     : ""
    };
    const options = {
            url: `https://www.googleapis.com/gmail/v1/users/${userId}/messages/${msgId}`,
            method: 'GET',
            headers : {
                'Authorization' : `Bearer ${accessToken}`
            }
        };
        
    rp(options).then(body => {
        const header = JSON.parse(body).payload.headers;
        let important;
        notification.payload = JSON.stringify(body);
        header.forEach(function(val){
            if (val.name === "Subject"){
                notification.title   = val.value;
                notification.snippet = JSON.parse(body).snippet;
                notification.messageID = JSON.parse(body).id;
            }
        })

        header.forEach(function(val){
            if(val.name === "From"){
                important = filterMsg(userId,val.value,notification.title).then(resolve=>{
                    if(resolve){
                        addImportantMsg(userId,msgId,true);
                        callback(null,notification,important);
                    }
                });
            }
        })
    }).catch(err => {
        console.log("getMsg error : " + err);
    })
}

function sendToDevice(notification,regToken,callback){
    
    const payload = {
        notification : {
            title : notification.title,
            body  : notification.snippet,
            color : '#4C64EB',
            icon  : 'notification_icon'
        },
        data : {
            id      : notification.messageID
        }
    };
    admin.messaging().sendToDevice(regToken, payload)
    .then(function(response) {
        // See the MessagingTopicResponse reference documentation for the
        // contents of response.
        callback(null,'done');
    })
    .catch(error => {
        console.log("Error sending message:", error);
    });
}

function watch(userName,accessToken,key,callback){
    const postOptions = { 
        method: 'POST',
        url: `https://www.googleapis.com/gmail/v1/users/${userName}/watch`,
        headers: { 
            'Authorization': `Bearer ${accessToken}` ,
            'Content-Type' : 'application/json' 
        },
        body: { 
            topicName: 'projects/moodle-announcement-trac-347e7/topics/gmail-push-notification',
            labelIds: [ 'INBOX' ] 
        },
      json: true 
    };

    return rp(postOptions).then(body => {
        db.ref(`GmailSub/${key}`).update({
            historyId : body.historyId
        }).then(resolve =>{
                if(callback!== 1){
                    callback(null, 'done');
                }
            })
            .catch(err => console.log(err));
    })
}

function filterMsg(userId,from,title){
    const dbRef = db.ref("Keyword");
    return new Promise((resolve,reject)=>{
        dbRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
            snapshot.forEach(snapshotChild=>{
                snapshotChild.forEach(snap=>{
                    if(snap.key !== 'userName'){
                        const emailRegex = new RegExp(snap.val().from.split('@')[0]);
                        const nameRegex = new RegExp("^" + snap.val().name);
                        if(emailRegex.test(from)){
                            if(snap.val().name !== "any"){
                                if(nameRegex.test(from)){
                                    for(const subject in snap.val().keywords){
                                        const subjectRegex = new RegExp(snap.val().keywords[subject]);
                                        console.log(subjectRegex);
                                        if(snap.val().keywords[subject] === "any" || subjectRegex.test(title)){
                                            resolve(true);
                                        }
                                    }
                                }
                            }
                            else{
                                resolve(true);
                            }
                        }
                    }
                })
            })
            reject(false);
        })
        .catch(err => console.log(err));
    })
}

function addImportantMsg(userId,id,add){
    const dbRef = db.ref("ImportantMsgId");
    dbRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot=>{
        if(snapshot.val() !== null){
            const key = Object.keys(snapshot.val())[0]; // To get the unique key
            const msgIdRef = db.ref(`ImportantMsgId/${key}/id`);

            msgIdRef.update({
                [id] : add
            })
            .catch(err => console.log(err));
        }
    })
    .catch(err => console.log(err));
}