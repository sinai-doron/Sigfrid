var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var moment = require('moment');
var config = require('config');
var winston = require('winston');
require('./winston-config.js');
var debugLogger = winston.loggers.get('all');
var errorLogger = winston.loggers.get('terror');

var options = JSON.stringify(config.get("emailConfiguration"));
options = JSON.parse(options);

var transporter = nodemailer.createTransport(smtpTransport(options))

function sendMail(mailData){
    var emails = config.get("emails");
    var to = "";
    if(emails instanceof Array){
        for(var i=0; i < emails.length; i++){
            to += emails[i];
            if(i != (emails.length-1))
                to += ',';
        }
    }
    else{
        to = emails;
    }

    debugLogger.info('Going to send mail to: ' ,to);
    transporter.sendMail({
        from: options.auth.user,
        to: to,
        subject: mailData.subject,
        text: mailData.text
    }, function (err, info) {
        if(err) errorLogger
        else debugLogger.info(info)
    });
}

function sendMailJob(agenda){
    agenda.define('send mail',function(job,done) {
        var mailData = {
            subject: job.attrs.data.mailSubject,
            text: job.attrs.data.mailBody
        }
        sendMail(mailData);
        done();
    });
}


module.exports = sendMailJob;