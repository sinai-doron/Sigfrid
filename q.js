/**
 * Created by doron on 10/28/14.
 */

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var config = require('config');

var options = JSON.stringify(config.get("emailConfiguration"));
console.log(options);
options = JSON.parse(options);
console.log(options);
var transporter = nodemailer.createTransport(smtpTransport(options))


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

        console.log('Going to send mail');
        console.log(to);
        transporter.sendMail({
            from: options.auth.user,
            to: to,
            subject: "still a test",
            text: "test"
        }, function (err, info) {
            console.log(err);
            console.log(info);
        });

