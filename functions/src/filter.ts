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