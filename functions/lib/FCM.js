"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const db = admin.database();
const recentMsgRef = db.ref('RecentMsg');
function sendToDevice(userId, notification, regToken, callback) {
    let notiObj = [];
    let body = "";
    let key = "";
    let obj = {
        sender: notification.sender,
        title: notification.title,
        snippet: notification.snippet
    };
    recentMsgRef.orderByChild("userName").equalTo(userId).once("value").then(snapShot => {
        key = Object.keys(snapShot.val())[0]; // To get the unique key
        recentMsgRef.child(key).push().set(obj)
            .then(() => {
            recentMsgRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
                snapshot.forEach(childSnapshot => {
                    childSnapshot.forEach(snap => {
                        if (snap.key !== "userName") {
                            let msgObj = {};
                            msgObj['sender'] = snap.val().sender;
                            msgObj['title'] = snap.val().title;
                            msgObj['snippet'] = snap.val().snippet;
                            notiObj.push(msgObj);
                        }
                    });
                });
                for (let i = 0; i < notiObj.length; i++) {
                    body += `${notiObj[i].sender} : ${notiObj[i].title}\n`;
                }
                body.slice(0, 2);
                const emailNo = notiObj.length > 1 ? "emails" : "email";
                const title = `You recently have ${notiObj.length} important ${emailNo} to look at :`;
                const payload = {
                    notification: {
                        title: title,
                        body: body,
                        color: '#003fbd',
                        icon: 'notification_icon',
                        tag: '1'
                    },
                    data: {
                        id: notification.messageID
                    }
                };
                admin.messaging().sendToDevice(regToken, payload)
                    .then(function (response) {
                    // See the MessagingTopicResponse reference documentation for the
                    // contents of response.
                    callback(null, 'done');
                })
                    .catch(error => {
                    console.log("Error sending message:", error);
                });
            })
                .catch(err => {
                console.log(err);
            });
        })
            .catch(err => {
            console.log(err);
        });
    })
        .catch(err => {
        console.log(err);
    });
}
exports.sendToDevice = sendToDevice;
//# sourceMappingURL=FCM.js.map