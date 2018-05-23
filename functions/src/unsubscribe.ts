/*******************************************************************************
 * Cloud function to remove regToken of logged out user from database          *
 *******************************************************************************/

import * as admin from 'firebase-admin';

const db = admin.database();
const gmailSubRef = db.ref("GmailSub");

/* Remove regToken of logged out user from database */
function unsubscribe(req,res){
    const body = req.body;

    gmailSubRef.orderByChild("userName/").equalTo(body.name).once("value", snapshot => {
        if(snapshot.val() !== null){
            const key = Object.keys(snapshot.val())[0]; // To get the unique key
            const regTokenref = db.ref(`GmailSub/${key}/regToken`);
            const regToken = body.regToken;

            regTokenref.orderByKey().equalTo(regToken).once("value" , snapShot => {
                if(snapShot.val() !== null){
                    regTokenref.update({
                        [regToken] : null
                    })
                    .catch(err => console.log(err));
                }
            }).catch(err =>{
                console.log("error when checking if regToken exist : " + err);
            })
        }
            res.end();
    })
    .catch(err => console.log(err));
}

export { unsubscribe };