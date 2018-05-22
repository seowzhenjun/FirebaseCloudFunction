"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const db = admin.database();
function addImportantMsg(userId, id, add) {
    const dbRef = db.ref("ImportantMsgId");
    dbRef.orderByChild("userName").equalTo(userId).once("value").then(snapshot => {
        if (snapshot.val() !== null) {
            const key = Object.keys(snapshot.val())[0]; // To get the unique key
            const msgIdRef = db.ref(`ImportantMsgId/${key}/id`);
            msgIdRef.update({
                [id]: add
            })
                .catch(err => console.log(err));
        }
    })
        .catch(err => console.log(err));
}
exports.addImportantMsg = addImportantMsg;
//# sourceMappingURL=addImportantMsg.js.map