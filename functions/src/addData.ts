/********************************************************************************************
 * Cloud function to register new users to Firebase database                                *
 * This function is triggered when user logs in to the app                                  *
 * It checks for existence of user data in database, if it exists, then update              *
 * its refresh token and regToken, if it doesn't exist, then create a new                   *
 * database entry and set the basic information of user into that entry                     *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as admin from 'firebase-admin';

const db = admin.database();
const gmailSubRef = db.ref("GmailSub");

function addData(req,res){
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
}

export { addData };