import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as rp from 'request-promise';
import * as async from 'async';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

const clientID = '115491863039-5pg6f5sdgeg696rh8fq85golnk53lm92.apps.googleusercontent.com';
const clientSecret = 'NSruyviJurAinT3fxdYztTYu';
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
                historyList(userId, startHistoryId, accessToken, callback);
            },
            function(msgId,callback){
                getMsg(userId, access_Token, msgId, callback);
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

export interface userData{
    userName : string;
    refreshToken : string;
    key : string;
}

export interface notificationObj{
    sender  : string;
    title   : string;
    snippet : string;
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
        payload     : "",
        sender      : ""
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
            if(val.name === "From"){
                notification.sender = val.value.split('<')[0];;
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

function sendToDevice(userId, notification,regToken,callback){
    let notiObj : notificationObj[] = [];
    let body    : string = ""; 
    let key     : string = "";
    let obj     : notificationObj = {
        sender  : notification.sender,
        title   : notification.title,
        snippet : notification.snippet
    };

    recentMsgRef.orderByChild("userName").equalTo(userId).once("value").then(snapShot => {
        key = Object.keys(snapShot.val())[0]; // To get the unique key
        
        recentMsgRef.child(key).push().set(obj)
        .then(()=>{
            recentMsgRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
                snapshot.forEach(childSnapshot=>{
                    childSnapshot.forEach(snap=>{
                        if(snap.key!=="userName"){
                            let msgObj = {} as notificationObj ;
        
                            msgObj['sender'] = snap.val().sender;
                            msgObj['title'] = snap.val().title;
                            msgObj['snippet'] = snap.val().snippet;
                            notiObj.push(msgObj);
                        }
                    });
                });

                for(let i=0; i<notiObj.length; i++){
                    body += `${notiObj[i].sender} : ${notiObj[i].title}\n`;
                }
                body.slice(0,2);
                const emailNo = notiObj.length > 1? "emails" : "email";
                const title = `You recently have ${notiObj.length} important ${emailNo} to look at :`;
            
                const payload = {
                    notification : {
                        title : title,
                        body  : body,
                        color : '#003fbd',
                        icon  : 'notification_icon',
                        tag   : '1'
                    },
                    data : {
                        id    : notification.messageID
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
            })
            .catch(err=>{
                console.log(err);
            })
        })
        .catch(err=>{
            console.log(err);
        });

        
        
    })
    .catch(err=>{
        console.log(err);
    }) ;
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
    let isReject : boolean = false;
    return new Promise((resolve,reject)=>{
        dbRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
            snapshot.forEach(snapshotChild=>{
                snapshotChild.forEach(snap=>{
                    if(snap.key !== 'userName'){
                        const fromRegex = new RegExp(snap.val().from.toLowerCase().split('@')[0]);
                        const nameRegex = new RegExp("^" + snap.val().name.toLowerCase());
                        if(snap.val().from !== 'any' && !fromRegex.test(from.toLowerCase())){
                            isReject = true;
                        }
                        else{
                            isReject = false;
                        }

                        if(snap.val().name === 'any' && !nameRegex.test(from.toLowerCase())){
                            isReject = true;
                        }
                        else{
                            isReject = false;
                        }

                        if(!isReject){
                            for(const subject in snap.val().keywords){
                                const subjectLine = snap.val().keywords[subject];
                                if(subjectLine === 'any'){
                                    resolve(true);
                                }
                                else{
                                    if(snap.val().useRegex[subject]){
                                        const subjectArr = subjectLine.split(' ');
                                        for( let x=0; x < subjectArr.length; x++){
                                            const subjectRegex = new RegExp(subjectArr[x].toLowerCase());
                                            if(!subjectRegex.test(title.toLowerCase())){
                                                isReject = true;
                                            }
                                        }
                                        if(!isReject){
                                            resolve(true);
                                        }
                                    }
                                    else{
                                        const subjectLineRegex = new RegExp(subjectLine.toLowerCase());
                                        if(!subjectLineRegex.test(title.toLowerCase())){
                                            isReject = true;
                                        }
                                        else{
                                            resolve(true);
                                        }
                                    } 
                                } 
                            }
                        }
                    }
                })
            })
            if(isReject){
                reject(false);
            }
            else{
                resolve(true);
            }
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