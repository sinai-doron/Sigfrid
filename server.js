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
var async = require('async');
var request = require('request');
var config = require("config");
var xml2js = require('xml2js');
var _ = require('lodash');
//compression
var compression = require('compression');
var mongoose = require('mongoose');
var cynwrig = require('cynwrig');
var session = require('express-session');
var moment = require('moment');
var cookieConfig = 	{
    httpOnly: true,
        secure: false, //process.env === 'production', TODO:disscuss this matter
        maxAge: 1000 * 60 * 60 * 24 * 31,
        signed: true
};

var apiKey = config.get("apiKey"); //API key for the tv db
var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
});
require("./db.js")
var User = mongoose.model('User');
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');


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
//app.use(require('csurf')());
/*app.use(function(req, res, next){
    res.locals._csrfToken = req.csrfToken();
    next();
});
app.use(function(req,res,next) {
    //apparantly csurf doesn't set the correct cookie when a cookie property is set in options
    //so setting it manually here, should work everytime, unless someone requests index.html explicitly
    //https://github.com/expressjs/csurf/issues/13
    res.cookie('XSRF-TOKEN', req.csrfToken()); //this will not work inside an if statment if the session are over before the client delete its cookies!
    next();
})*/

//disable sending information regarding the server type
app.disable('x-powered-by');

app.get('/', function(req, res){
    res.sendFile('/public/index.html');
});

app.get('/api/shows', function(req, res, next) {
    var query = Show.find();
    if (req.query.genre) {
        query.where({ genre: req.query.genre });
    } else if (req.query.alphabet) {
        query.where({ name: new RegExp('^' + '[' + req.query.alphabet + ']', 'i') });
    } else {
        query.limit(120);
    }
    query.exec(function(err, shows) {
        if (err) return next(err);
        res.send(shows);
    });
});

app.get('/api/shows/:id', function(req, res, next) {
    Show.findById(req.params.id)
        .populate('episodes', null, null, {sort:{'season':1, 'episodeNumber':1}})
        .exec(function(err, show) {
            if (err) return next(err);
            res.send(show);
        });
});

app.post('/api/shows/:id', function(req, res, next){
    Show.findById(req.params.id,function(err,show){
        if (err){
            console.log('Error' + err);
            return next(err);
        }
        if(show){
            var p = req.body
            if(p["url"]){
                show["url"] = p["url"];
            }
            show.save(function(err,savedShow){
                if(err){
                    res.status(500).end();
                    console.log(err);
                }
                res.send(200);
            });
        }
        else{
            res.status(404).end();
        }
    });
});
app.put('/api/episodes/:id', function(req, res, next){

    Episode.findById(req.params.id,function(err,episode){
        if (err){
            console.log('Error' + err);
            return next(err);
        }
        episode.watched = req.body.watched;
        console.log('done ' + episode._id);
        episode.save(function(err,user){
            if(err) console.log(err);
            console.log('User saved:', user);
            res.send(200);
        });
    })
})
app.get('/api/shows/date/:year/:month', function(req, res, next) {
    var month = parseInt(req.params.month) - 1;
    var year = parseInt(req.params.year);
    var start = moment([year,month,1,0,0,0]);
    var end = moment(start).add(1, 'month');
    if(!start.isValid() || !end.isValid()){
        res.status(400).send('Bad date');
        return;
    }
    console.log('Look for episodes in range: ', start.toDate(), ' to ', end.toDate())
    Episode.find({firstAired:{$gte:start.toDate(), $lt:end.toDate()}},{season:1,episodeNumber:1,watched:1,showName:1,firstAired:1},function(err, results){
        res.status(200).send(results);
    });

});
app.put('/api/shows/:id/season/:number', function(req, res, next){
    Episode.find({
        showId:req.params.id,
        season:req.params.number
    },function(err,episodes){
       if(err) res.status(500).send('Unsuccessful');
        console.log(episodes);
        _.each(episodes, function(episode) {
            episode.watched = true;
            episode.save(function(err,episode){
                if(err) res.status(500).send('Unsuccessful');
            });
        });
        res.status(200).send('OK');
    });
})
app.post('/api/shows', function(req, res, next) {
    var seriesName = req.body.showName
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/[^\w-]+/g, '');
    if(req.body.seriesId){
        var responseSeriesId = req.body.seriesId
    }
    else{
        responseSeriesId = null;
    }
    async.waterfall([
        function(callback) {
            if(responseSeriesId){
                callback(null, responseSeriesId);
                return;
            }
            request.get('http://thetvdb.com/api/GetSeries.php?seriesname=' + seriesName, function(error, response, body) {
                if (error) return next(error);
                parser.parseString(body, function(err, result) {
                    if (!result.data.series) {
                        return res.send(404, { message: req.body.showName + ' was not found.' });
                    }
                    else if (result.data.series.length > 1){
                        return res.send(430, {message: req.body.showName + ' Matches too many results', data:result.data.series})
                    }
                    var seriesId = result.data.series.seriesid || result.data.series[0].seriesid;
                    callback(err, seriesId);
                });
            });
        },
        function(seriesId, callback) {
            request.get('http://thetvdb.com/api/' + apiKey + '/series/' + seriesId + '/all/en.xml', function(error, response, body) {
                if (error) return next(error);
                parser.parseString(body, function(err, result) {
                    var series = result.data.series;
                    var episodes = result.data.episode;
                    var showEpisodes = []

                    _.each(episodes, function(episode) {
                        var newEpisode = new Episode({
                            episodeId: episode.id,
                            showId:series.id,
                            showName: series.seriesname,
                            season: episode.seasonnumber,
                            episodeNumber: episode.episodenumber,
                            episodeName: episode.episodename,
                            firstAired: episode.firstaired,
                            overview: episode.overview,
                            watched: false,
                            absoluteNumber:episode["absolute_number"],
                            imageLocation:episode["filename"],
                            thumbHeight:episode["thumb_height"],
                            thumbWidth:episode["thumb_width"]
                        })
                        console.log(newEpisode.showName)
                        showEpisodes.push(newEpisode._id);
                        newEpisode.save(function(err) {
                            if (err) {
                                console.log(err);
                            }
                        });
                    });
                    var show = new Show({
                        _id: series.id,
                        name: series.seriesname,
                        airsDayOfWeek: series.airs_dayofweek,
                        airsTime: series.airs_time,
                        firstAired: series.firstaired,
                        genre: series.genre.split('|').filter(Boolean),
                        network: series.network,
                        overview: series.overview,
                        rating: series.rating,
                        ratingCount: series.ratingcount,
                        runtime: series.runtime,
                        status: series.status,
                        poster: series.poster,
                        episodes: showEpisodes
                    });
                    callback(err, show);
                });
            });
        },
        function(show, callback) {
            var url = 'http://thetvdb.com/banners/' + show.poster;
            request({ url: url, encoding: null }, function(error, response, body) {
                show.poster = 'data:' + response.headers['content-type'] + ';base64,' + body.toString('base64');
                callback(error, show);
            });
        }
    ], function(err, show) {
        if (err) return next(err);
        show.save(function(err) {
            if (err) {
                if (err.code == 11000) {
                    return res.send(409, { message: show.name + ' already exists.' });
                }
                return next(err);
            }
            res.send(200);
        });
    });
});

app.get('*', function(req, res) {
    res.redirect('/#' + req.originalUrl);
});
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.send(500, { message: err.message });
});

http.createServer(app).listen(app.get('port'), function(){
    console.log( 'http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.' );
});