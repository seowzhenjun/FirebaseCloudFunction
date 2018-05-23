/********************************************************************************************
 * Function to save ID of important email to user's database entry                          *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as admin from 'firebase-admin';

const db = admin.database();

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

export { addImportantMsg };