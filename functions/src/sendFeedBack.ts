/********************************************************************************************
 * Cloud function to send feedback email from user to moodletracker.feedback@gmail.com      *
 * This function is triggered when user submits feedback form through the app               *
 * Data sent from the app are restucture to become more readable and is sent through        * 
 * NPM plugin NodeMailer                                                                    *
 *                                                                                          *
 * Written by : Zhen Jun Seow                                                               *
 * Depart of Electrical and Computer System Engineering (ECSE), Monash University Australia *
 * Last edited : 23/05/2018                                                                 *
 ********************************************************************************************/

import * as nodemailer from 'nodemailer';
import * as pwd from './password';

const version = "0.1 (beta)";

function sendFeedBack(req,res){
    const body = req.body;
    let text ='';
    //This is the transporter to send the email
    const transporter = nodemailer.createTransport({
        service : 'gmail',
        auth: {
            user: 'moodletracker.feedback@gmail.com',
            pass : pwd.emailPwd
        }
    });

    if(!body.body.anonymous){
        text+=`From : ${body.body.userName} (${body.body.email})\n`;
    }
    else{
        text += 'From : Anonymous user\n';
    }
    switch(body.body.feedbackType){
        case 'bug' :
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\nBug type : ${body.body.bugType}\nSeverity : ${body.body.severity}\nDescription : ${body.body.description}`;
        break;
        case 'feedback' :
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\n\nSet up rating : ${body.body.setUpRating}/5\nTutorial rating : ${body.body.tutorialRating}/5\nSuggested keywords accuracy rating : ${body.body.suggestedKeywordRating}/5\nNotifications accuracy rating : ${body.body.notificationRating}/5\nOverall rating : ${body.body.overallRating}/5\n\nComment : ${body.body.description}`;
        break;
        default:
            text += `Version : ${version}\nFeedback type : ${body.body.feedbackType}\nDescription : ${body.body.description}`;
        break;

    }
    
    const testMail = {
        from: 'moodletracker.feedback@gmail.com',
        to: 'moodletracker.feedback@gmail.com',
        subject: 'Feedback from Moodle Announcement Tracker',
        text: text
    };

    transporter.sendMail(testMail, function(error, info){    //then sends an email
        if (error) {
            console.log(error);
            res.send({response:'error'});
        } else {
            res.send({response :'success'});
        }
    });
}

export { sendFeedBack };