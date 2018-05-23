/********************************************************************************************
 * Cloud function to subscribe new user to Google Pub/Sub topic                             *
 * This function is triggered on newly created database entry in GmailSub                   *
 * It calls Gmail API watch() function to subscribe to Google Pub/Sub topic                 *
 * 'gmail-push-notification'                                                                *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as async from 'async';
import { refreshtoken } from './oAuth2'; 
import * as GmailAPI from './GmailAPI';

function subscribe(snap, context){
    const key = snap.key;
    const userName = snap.val().userName;
    const refreshToken = snap.val().refreshToken;

    // Flow of async Gmail REST calls to make sure they run in order
    return async.waterfall([
        function(callback){
            refreshtoken(refreshToken, callback);
        },
        function(accessToken,callback){
            GmailAPI.watch(userName,accessToken,key,callback);
        }
    ],function(err, result){
        if(err) return (err);
    });
}

export { subscribe };