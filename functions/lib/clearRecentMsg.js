"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const db = admin.database();
const recentMsgRef = db.ref('RecentMsg');
function clearRecentMsg(req, res) {
    recentMsgRef.once("value", snapShot => {
        snapShot.forEach(childSnapshot => {
            childSnapshot.forEach(snap => {
                if (snap.key !== "userName") {
                    const ref = recentMsgRef.child(`${childSnapshot.key}/${snap.key}`);
                    ref.remove().catch(err => console.log(err));
                }
                return false;
            });
            return false;
        });
    }).then(() => {
        res.end();
    }).catch(err => {
        console.log(err);
    });
}
exports.clearRecentMsg = clearRecentMsg;
//# sourceMappingURL=clearRecentMsg.js.map