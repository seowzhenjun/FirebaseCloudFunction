"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const async = require("async");
const oAuth2_1 = require("./oAuth2");
const GmailAPI = require("./GmailAPI");
/* Cloud function to subscribe new user to Google Pub/Sub topic*/
function subscribe(snap, context) {
    const key = snap.key;
    const userName = snap.val().userName;
    const refreshToken = snap.val().refreshToken;
    // Flow of async Gmail REST calls to make sure they run in order
    return async.waterfall([
        function (callback) {
            oAuth2_1.refreshtoken(refreshToken, callback);
        },
        function (accessToken, callback) {
            GmailAPI.watch(userName, accessToken, key, callback);
        }
    ], function (err, result) {
        if (err)
            return (err);
    });
}
exports.subscribe = subscribe;
//# sourceMappingURL=subscribe.js.map