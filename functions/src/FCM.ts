/********************************************************************************************
 * Function to pass notification text and registration token to FCM                         *
 * This function saves detail of important email into RecentMsg tree, and fetch recent      *
 * important emails, then restructure the notification text into the following form:        *
 *                                                                                          *
 * "You recently have %d important email to look at :                                       *
 *  email sender 1 : email title 1                                                          *
 *  ..."                                                                                    *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as admin from 'firebase-admin';
import * as interfaces from './interfaces';

const db = admin.database();
const recentMsgRef = db.ref('RecentMsg');

function sendToDevice(userId, notification,regToken,callback){
    let notiObj : interfaces.notificationObj[] = [];
    let body    : string = ""; 
    let key     : string = "";
    let obj     : interfaces.notificationObj = {
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
                            let msgObj = {} as interfaces.notificationObj ;
        
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

export { sendToDevice };