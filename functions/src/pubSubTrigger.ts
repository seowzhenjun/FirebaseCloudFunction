/********************************************************************************************
 * Cloud function to retrieve any new email from user inbox, and run filter algorithm       *
 * to determine if use should be notified                                                   *
 * This function is on new message published to Cloud Pub/Sub topic                         *
 * Pub/Sub message has the following structure :                                            *
 * { emailAddress : email address of the corresponding user                                 *
 *   historyId    : latest historyId to be kept }                                           *
 * The function first retrieve the last historyId of user, get changes in user inbox        *
 * with histryList() function, then retreieve any new added message, then apply filter      *
 * algorithm. If the email passes the filter, then save this email to RecentMsg,            *
 * while retrieving any other recent message, then send to FCM via sendToDevice() API,      *
 * which then sends push notification to user's device. The function also replace           *
 * old historyId with the one received                                                      *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as admin from 'firebase-admin';
import * as async from 'async';
import * as GmailAPI from './GmailAPI';
import { refreshtoken } from './oAuth2';
import { sendToDevice } from './FCM';

const db = admin.database();
const gmailSubRef = db.ref("GmailSub");

function pubSubTrigger(change, context){
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
}

export { pubSubTrigger };