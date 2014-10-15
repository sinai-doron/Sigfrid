/**
 * Created by Doron Sinai on 14/10/2014.
 */
var fs = require('fs');
var winston = require('winston');
var http = require('http');
var https = require('https');
var express = require('express');
var passport = require('passport');
var bodyParser = require('body-parser');
//compression
var compression = require('compression');
var mongoose = require('mongoose');
var cynwrig = require('cynwrig');
var session = require('express-session');
var cookieConfig = 	{
    httpOnly: true,
        secure: false, //process.env === 'production', TODO:disscuss this matter
        maxAge: 1000 * 60 * 60 * 24 * 31,
        signed: true
};
var app = express();
app.set('port', process.env.PORT || 9999);
//add compression middleware
app.use(compression({
    threshold: 512
}));
//Set the public directory
app.use(express.static(__dirname + '/public'));

//body parsing middleware
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(require('cookie-parser')("There are always 2 numbers 13 and 3 but there is also 4"));
app.use(require('express-session')({
    secret: "There are always 2 numbers 13 and 3 but there is also 4",
    resave:false, // TODO: remove when Redis is configures
    saveUninitialized:false, // TODO: remove when Redis is configured
    cookie: cookieConfig //TODO: config back Redis for session storage
    /*store: new RedisStore({
     client: redisClient,
     ttl: time.oneMonth
     })*/}));
app.use(require('csurf')());
app.use(function(req, res, next){
    res.locals._csrfToken = req.csrfToken();
    next();
});
app.use(function(req,res,next) {
    //apparantly csurf doesn't set the correct cookie when a cookie property is set in options
    //so setting it manually here, should work everytime, unless someone requests index.html explicitly
    //https://github.com/expressjs/csurf/issues/13
    res.cookie('XSRF-TOKEN', req.csrfToken()); //this will not work inside an if statment if the session are over before the client delete its cookies!
    next();
})

//disable sending information regarding the server type
app.disable('x-powered-by');

app.get('/', function(req, res){
    res.sendFile('/public/index.html');
});


http.createServer(app).listen(app.get('port'), function(){
    console.log( 'http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.' );
});