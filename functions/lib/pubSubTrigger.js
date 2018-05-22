"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const async = require("async");
const GmailAPI = require("./GmailAPI");
const oAuth2_1 = require("./oAuth2");
const FCM_1 = require("./FCM");
const db = admin.database();
const gmailSubRef = db.ref("GmailSub");
/* Cloud function that accept historyId from Google Pub/Sub, retrieve the previous user's historyId,
   and replace it with the current one, and checks for any new email from user inbox,
   and sends it to user's as push notifications */
function pubSubTrigger(change, context) {
    const messageBody = change ? Buffer.from(change.data, 'base64').toString() : null;
    const keydata = JSON.parse(messageBody);
    const historyId = keydata.historyId;
    const userId = keydata.emailAddress;
    let key, access_Token;
    // Fetch startHistoryId and accessToken from db
    return gmailSubRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
        let startHistoryId, refreshToken, regToken;
        const regTokenArr = [];
        key = Object.keys(snapshot.val())[0]; // To get the unique key
        snapshot.forEach(function (childSnapshot) {
            startHistoryId = childSnapshot.val().historyId;
            refreshToken = childSnapshot.val().refreshToken;
            regToken = childSnapshot.val().regToken;
        });
        for (const k in regToken) {
            regTokenArr.push(k);
        }
        // Flow of async Gmail REST calls to make sure they run in order
        async.waterfall([
            function (callback) {
                oAuth2_1.refreshtoken(refreshToken, callback);
            },
            function (accessToken, callback) {
                access_Token = accessToken;
                GmailAPI.historyList(userId, startHistoryId, accessToken, callback);
            },
            function (msgId, callback) {
                GmailAPI.getMsg(userId, access_Token, msgId, callback);
            },
            function (notification, important, callback) {
                if (important) {
                    FCM_1.sendToDevice(userId, notification, regTokenArr, callback);
                }
            }
        ], function (err, result) {
            if (err)
                return (err);
        });
    }).then(() => {
        db.ref(`GmailSub/${key}`).update({
            historyId: historyId
        })
            .catch(err => console.log(err));
    }).catch(error => {
        console.log("pubsubTrigger err : " + error);
    });
}
exports.pubSubTrigger = pubSubTrigger;
//# sourceMappingURL=pubSubTrigger.js.map