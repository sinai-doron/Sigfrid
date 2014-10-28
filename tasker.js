/**
 * Created by Doron Sinai on 23/10/2014.
 */
var mongoose = require('mongoose');
var request = require('request');
var xml2js = require('xml2js');
var moment = require('moment');
var Agenda = require('agenda');
var async = require('async');
var winston = require('winston');
var fs = require('fs');
var _ = require('lodash');
var jsdom = require("jsdom").jsdom;
var config = require('config');
var Q = require('q');
var downloadFolder = config.get('downloadFolder');
require('./winston-config.js');
require("./db.js");
var mailer = require('./mailer.js');
var debugLogger = winston.loggers.get('all');
var errorLogger = winston.loggers.get('terror');
var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
});
var apiKey = '94110B1EA4F695E8'; //API key from the tv db
var User = mongoose.model('User');
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');


function checkAndCreateFolder(folder){
    if(fs.existsSync(folder)){
        return true;
    }
    else{
        fs.mkdirSync(folder);
        if(fs.existsSync(folder)){
            return true;
        }
        return false;
    }
}

function downloadFile(url, folder, defer){
    var ret = [];
    var len = 0;
    var zlib = require("zlib");
    debugLogger.info('Going to download from the following URL: ' + url);
    debugLogger.info('and save it in this folder: ' + folder);
    request({
        url:url,
        gzip:true,
        headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
    }).on('response', function(res){
        var path = res.request.uri.path.split('/');
        var fileName = path[path.length-1];
        debugLogger.info('Giving it this filename: ' + fileName);

        res.on('data', function (data) {
            ret.push(data);
            len += data.length;
        });

        res.on('end', function(){
            var buffer = Buffer.concat(ret, len);
            var encoding = res.headers['content-encoding'];
            var folderName = downloadFolder + folder + '/';
            if(!checkAndCreateFolder(folderName)){
                errorLogger.error('Can not create folders');
                defer.reject("Error creating folders");
                return;
            }
            var wstream = fs.createWriteStream(folderName + fileName);
            if (encoding == 'gzip') {
                zlib.gunzip(buffer, function(err, decoded) {
                    wstream.write(decoded);
                    wstream.end();
                });
            } else if (encoding == 'deflate') {
                zlib.inflate(buffer, function(err, decoded) {
                    wstream.write(decoded);
                    wstream.end();
                })
            } else {
                wstream.write(buffer.toString());
                wstream.end();
            }
            defer.resolve({
                status:"sucess",
                filename:fileName
            })
        });
    }).on('error', function(err) {
        errorLogger.error('Error while trying to save file ' + err);
        defer.reject("Error downloading file");
    });;
}

/********************Set some tasks for later *******************/
var agenda = new Agenda({db: { address: 'localhost:27017/agendaJobs'}});

agenda.define('update db', function(job, done) {
    var showsInDb = {};var day = moment.unix(1413632472);
    var requestShow = [];
    var timestamp = moment().subtract(6,'days').unix();
    Show.find({},function(err, shows){
        if(err) {
            console.log(err);
            return;
        }
        _.each(shows, function(show){
            showsInDb[show._id] = 1;
        });
        console.log(showsInDb);
        console.log('going to ask the changes from: ' + timestamp + ', ' + moment.unix(timestamp).toDate());
        request.get('http://thetvdb.com/api/Updates.php?type=series&time='+timestamp, function(error, response, body) {
            if (error) return;
            parser.parseString(body, function(err, result) {
                if(err) console.log(err);
                _.each(result.items.series, function(series){
                    if(showsInDb[series]){
                        console.log('found: ' + series);
                        request.get('http://thetvdb.com/api/' + apiKey + '/series/' + series + '/all/en.xml', function(error, response, body) {
                            if (error) return next(error);
                            parser.parseString(body, function(err, result) {
                                var series = result.data.series;
                                var episodes = result.data.episode;

                                _.each(episodes, function(episode) {
                                    Episode.findOne({
                                        episodeId:episode.id
                                    },function(err, episode1){
                                        if(err) console.log('An error as occured: ' + err)
                                        if(!episode1){
                                            console.log('new episode saved'.green)
                                            var newEpisode = new Episode({
                                                episodeId: episode.id,
                                                showId:series.id,
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
                                            newEpisode.save(function(err,episode) {
                                                Show.findById(series.id,function(err, show){
                                                    show.episodes.push(episode._id);
                                                    show.save(function(){})
                                                });
                                                if (err) {
                                                    console.log(err);
                                                }
                                            });
                                        }
                                        else{
                                            console.log('episode: '+episode.id + ' found in db')
                                        }
                                    })

                                });
                            });
                        });
                    }
                })


            });
        });
    })
    done()

});
agenda.define('today shows',function(job,done){
    var downloadDays = config.get('downloadDays');
    if(!downloadDays || isNaN(parseInt(downloadDays))){
        downloadDays = 1;
    }
    debugLogger.info('Number of days back to look for: ' +downloadDays);
    async.waterfall([
        // find relevant episode in the db
        function(callback){
            var start = moment().subtract(downloadDays, 'days').hour(0).minute(0).toDate();
            var end = moment().hour(0).minute(0).toDate();
            debugLogger.info('Look for episode in range: ' + start + ' - ' + end);
            Episode.find({firstAired:{$gte:start, $lt:end}},function(err, results){
                _.each(results, function(r){
                    debugLogger.info('Found the following: ', r.episodeId + ':' + r.episodeName);
                })

                if(err) callback(err);
                if(results.length < 1) {
                    debugLogger.info('No episode found for that data range');
                    callback(111);
                }
                callback(null,results);
            });
        },
        //extract the urls of each show to kickass torrents
        function(episodes, callback){
            var urls = [];
            var showsNumbers = {}
            Show.find({},function(err,shows){
                if(err) callback(err);

                for(var i=0; i <shows.length; i++){
                    var o = {}
                    o.url = shows[i].url;
                    o.name = shows[i].name;
                    showsNumbers[shows[i]._id] = o;
                }

                _.each(episodes,function(episode){
                    var u = {};
                    u.season = episode.season;
                    u.number = episode.episodeNumber;
                    u.url = showsNumbers[episode.showId]["url"];
                    u.name = showsNumbers[episode.showId]["name"];
                    if(u.url && (u.url !== "")){
                        urls.push(u);
                    }

                });
                if(urls.length ===0) callback(222);
                callback(null, urls)
            })
        },
        //go get the torrent files urls
        function(urls, callback){
            _.each(urls,function(url){
                console.log(url)
            });
            callback(null);
        }
    ], function (err, result) {
        if(err){
            if(err === 111){
                debugLogger.info('No episodes were found for today');
            }
            else if(err === 222){
                debugLogger.info('No links found in db');
            }
            else{
                errorLogger.error(err)
            }
        }
        done();
    });
})
mailer(agenda);
agenda.start();
/*agenda.now('send mail',{
    mailBody: "Something new"
});*/
agenda.now('today shows');
//agenda.every('24 hours', 'today shows');
//agenda.every('24 hours', 'update db');

/********************Set some tasks for later*******************/