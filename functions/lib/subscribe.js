// exports.handler = (snap, context)=>{
//     const key = snap.key;
//     const userName = snap.val().userName;
//     const refreshToken = snap.val().refreshToken;
//     // Flow of async Gmail REST calls to make sure they run in order
//     return async.waterfall([
//         function(callback){
//             refreshtoken(refreshToken, callback);
//         },
//         function(accessToken,callback){
//             watch(userName,accessToken,key,callback);
//         }
//     ],function(err, result){
//         if(err) return (err);
//     });
// }
//# sourceMappingURL=subscribe.js.map