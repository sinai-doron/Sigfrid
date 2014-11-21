/**
 * Created by Doron Sinai on 23/10/2014.
 */
var mongoose = require('mongoose');
var request = require('request');
var xml2js = require('xml2js');
var moment = require('moment');
var Agenda = require('agenda');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var jsdom = require("jsdom").jsdom;
var config = require('config');
var Q = require('q');
var downloadFolder = config.get('downloadFolder');
var winston = require('winston');
require('./winston-config.js');
require("./db.js");
var mailer = require('./mailer.js');
var updater = require('./updater.js');
var debugLogger = winston.loggers.get('all');
var errorLogger = winston.loggers.get('terror');
var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
});
var apiKey = config.get("apiKey"); //API key for the tv db
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

function requestSeriesPage(url){
    var debugMessagePrefix = '[' + url.name + ' S' + url.season + 'E' + url.number + '] ';
    var finishedRequest = Q.defer();
    var finishedRequestPromise = finishedRequest.promise;
    debugLogger.info(debugMessagePrefix + 'Going to request the page');

    request({
        url: url.url,
        gzip:true
    },  function(error, response, body) {
        debugLogger.info(debugMessagePrefix + 'Got a response back with status: ' + response.statusCode);
        if (!error && response.statusCode == 200) {
            debugLogger.info(debugMessagePrefix + 'About to parse the dom');
            jsdom.env(
                body,
                ["./jquery-2.1.1.min.js"],
                function (errors, window) {
                    if(errors) {
                        errorLogger.error(errors);
                        finishedRequest.reject("JSDOM error - see logs");
                        return;
                    }
                    if(url.number < 10){
                        url.number = '0' + url.number;
                    }
                    var node = window.$(window.$.find('h3:contains("Season 0' + url.season + '")')).next('div').find('span:contains("Episode ' + url.number + '")').parent().attr("onClick");
                    if(node && node.length > 1){
                        var episodeUrlTorrent = node.split('\'')[1];
                        if(episodeUrlTorrent){
                            debugLogger.info(debugMessagePrefix + 'Found the following episode number: ' + episodeUrlTorrent);
                            finishedRequest.resolve('' + episodeUrlTorrent);
                        }
                    }
                    else{
                        finishedRequest.reject("Did not find season in page");
                    }
                }
            );
        }
        else{
            errorLogger.error(error);
            finishedRequest.reject();
        }
    });

    //do it next
    finishedRequestPromise.then(function(episodeNumber){
        requestEpisodeSegment({episodeNumber: episodeNumber, debugMessagePrefix:debugMessagePrefix, name:url.name, deferred:url.deferred});
    }, function(reason){
        errorLogger.error(reason);
        url.deferred.reject(reason);
    }, function(){});  //.then(onFulfilled, onRejected, onProgress)
}

function requestEpisodeSegment(episode){
    var debugMessagePrefix = episode.debugMessagePrefix;
    var url = 'https://kickass.to/media/getepisode/' + episode.episodeNumber + '/';
    var finishedRequest = Q.defer();
    var finishedRequestPromise = finishedRequest.promise;

    debugLogger.info(debugMessagePrefix + 'Getting segment from: ' + url);

    request({
        url: url,
        gzip:true
    },  function(error, response, body) {
        if (!error && response.statusCode == 200) {
            jsdom.env(
                body,
                ["./jquery-2.1.1.min.js"],
                function (errors, window) {
                    if(errors) {
                        errorLogger.error("requestEpisodeSegment - jsdom - " + errors);
                        finishedRequest.reject("JSDOM error - see logs");
                        return;
                    }
                    debugLogger.info(debugMessagePrefix + "Look for x264 files in segment");
                    var node = window.$(window.$.find('tr:contains("x264")')).find(('a[title="Download torrent file"]'));
                    if (node.length < 1){
                        node = window.$.find('a[title="Download torrent file"]');
                        debugLogger.info(debugMessagePrefix + "No x264 torrents found in page");
                        if(node.length < 1){
                            debugLogger.info(debugMessagePrefix + "No torrents found - rejecting defer obj");
                            finishedRequest.reject("No torrents found");
                            return;
                        }
                    }
                    var nodeUrl = node[0].href;
                    finishedRequest.resolve(nodeUrl);
                }
            );
        }
        else{
            errorLogger.error("requestEpisodeSegment - request - " + error);
            finishedRequest.reject();
        }
    });

    //do it next
    finishedRequestPromise.then(function(nodeUrl){
        debugLogger.info(debugMessagePrefix + "Download file from: " + nodeUrl);
        downloadFile(nodeUrl, episode.name, episode.deferred);
    }, function(reason){
        errorLogger.error(reason);
        episode.deferred.reject(reason);
    }, function(){});  //.then(onFulfilled, onRejected, onProgress)
}

/********************Set some tasks for later *******************/
var agenda = new Agenda({db: { address: 'localhost:27017/agendaJobs'}});


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
                    debugLogger.info('No episode found for that date range');
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
            var promises = [];
            _.each(urls,function(url){
                console.log(url);
                var deferred = Q.defer();
                promises.push(deferred.promise);
                url.deferred = deferred;
                requestSeriesPage(url);
            });

            Q.allSettled(promises).spread(function(){
                var args = arguments;
                var sucessFiles = [];
                var failoureFiles = [];
                var mailSubject = "";
                var mailBody = "";
                var successString = "Success: \n";
                var failureString = "Failure: \n";
                for(var i=0; i<args.length; i++){
                    var promise = args[i];
                    if(promise.state === "fulfilled"){
                        sucessFiles.push(promise.value.filename);
                        successString += promise.value.filename + "\n"
                    }
                    else{
                        failoureFiles.push(promise.value);
                        failureString += promise.value + "\n";
                    }
                }
                if(failoureFiles.length === 0){
                    mailSubject = sucessFiles.length + " New episodes were downloaded successfully";
                }
                else{
                    mailSubject = sucessFiles.length + " New episodes were downloaded successfully and " + failoureFiles.length + " files had errors";
                }
                mailBody = successString + failureString;
                debugLogger.info('Going to send email: ', mailSubject ,mailBody)
                agenda.now('send mail',{
                    mailBody: mailBody,
                    mailSubject:mailSubject
                });


            }).done();

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
updater(agenda);
agenda.start();
agenda.every('24 hours', 'today shows');
agenda.every('24 hours', 'update db');

/********************Set some tasks for later*******************/