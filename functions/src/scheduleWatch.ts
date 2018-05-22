import * as async from 'async';
import * as admin from 'firebase-admin';

import { refreshtoken } from './oAuth2';
import * as interfaces from './interfaces';
import * as GmailAPI from './GmailAPI';

const db = admin.database();
const gmailSubRef = db.ref("GmailSub");

/* Invoke watch() request for all users in database once everyday at 8am.
   This is done automatically by cron-job */
function scheduleWatch(req,res){
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
}

export { scheduleWatch };