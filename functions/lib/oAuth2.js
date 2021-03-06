"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rp = require("request-promise");
const pwd = require("./password");
function refreshtoken(refreshToken, callback) {
    const postOptions = {
        method: 'POST',
        url: 'https://www.googleapis.com/oauth2/v4/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            client_id: pwd.clientID,
            client_secret: pwd.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        },
        json: true
    };
    rp(postOptions).then(body => {
        if (callback !== 1) {
            callback(null, body.access_token);
        }
    }).catch(err => {
        console.log("refreshToken error : " + err);
    });
}
exports.refreshtoken = refreshtoken;
//# sourceMappingURL=oAuth2.js.map