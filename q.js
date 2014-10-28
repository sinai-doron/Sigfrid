/**
 * Created by doron on 10/28/14.
 */
var Q = require('q');
var d1 = Q.defer();
var d2 = Q.defer();
var d3 = Q.defer();
var d4 = Q.defer();

var a = [d1.promise, d2.promise, d3.promise ,d4.promise];

Q.allSettled(a).spread(function(){
    console.log(arguments);
    for(var i=0;i<arguments.length;i++){
        console.log(arguments[i])
    }
}).done();

d1.resolve("d1");
d2.resolve("d2");
d3.reject("reject d3");
d4.resolve("d4");

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var options = {
    host: 'mail.sinai.mobi',
    port: 25,
    secure:false,
    debug:true,
    auth: {
        user: 'tv@sinai.mobi',
        pass: 'Iamtvserver1'
    }
}

var transporter = nodemailer.createTransport(smtpTransport(options))

        transporter.sendMail({
            from: 'tv@sinai.mobi',
            to: 'sinai.doron@gmail.com',
            subject: "l",
            text: "k"
        }, function (err, info) {
            console.log(err);
            console.log(info);
        });

