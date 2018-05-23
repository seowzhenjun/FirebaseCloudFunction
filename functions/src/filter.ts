/********************************************************************************************
 * Filtering algorithm to determine whether an email is important to user                   *
 * A filter rule has the following component :                                              *
 * - Sender name                                                                            *
 * - Sender email address                                                                   *
 * - Subject line                                                                           *
 * - Use regex?                                                                             *
 *                                                                                          *
 * Incoming email is compared in the following order : sender name -> email add -> subject  *
 * line. Note that if any of the field has the word "any", then the comparison in that field*
 * is skipped. In subject line, if useRegex is set to true, then each of the word in subject*
 * line is break into a regular expression. If all the words exist in title of the email,   *
 * then the title matches the subject line. Else, the whole subject line has to be a        *
 * substring of the title in order to match. If the incoming email macthes all 3 components,*
 * then it is considered as important.                                                      *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as admin from 'firebase-admin';

const db = admin.database();

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

export { filterMsg };