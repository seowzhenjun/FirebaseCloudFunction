import * as rp from 'request-promise';
import * as admin from 'firebase-admin';

import { addImportantMsg } from './addImportantMsg';
import { filterMsg } from './filter';

const db = admin.database();

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
        })
        .then(resolve =>{
            if(callback!== 1){
                callback(null, 'done');
            }
        })
        .catch(err => console.log(err));
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
                    addImportantMsg(userId,msgId,true);
                    callback(null,notification,important);
                },reject=>{
                    console.log("Message is not important");
                });
            }
        })
    }).catch(err => {
        console.log("getMsg error : " + err);
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

export { watch } ;
export { getMsg };
export { historyList };