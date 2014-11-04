var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var moment = require('moment');
var Agenda = require('agenda');

var options = {
    host: 'mail.sinai.mobi',
    port: 587 ,
    secure:false,
    debug:true,
    auth: {
        user: 'tv@sinai.mobi',
        pass: 'Iamtvserver1'
    }
}

var transporter = nodemailer.createTransport(smtpTransport(options))

function sendMail(agenda){
    agenda.define('send mail',function(job,done) {
        console.log('Going to send mail');
        console.log(job.attrs.data.mailBody);
        transporter.sendMail({
            from: 'tv@sinai.mobi',
            to: 'sinai.doron@gmail.com',
            subject: job.attrs.data.mailSubject,
            text: job.attrs.data.mailBody
        }, function (err, info) {
            console.log(err);
            console.log(info);
        });
        done();
    });
}


module.exports = sendMail;