import * as admin from 'firebase-admin';

const db = admin.database();
const gmailSubRef = db.ref("GmailSub");

/* Cloud function to register new users to Firebase database */
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