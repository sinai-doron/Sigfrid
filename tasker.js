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
var downloadFolder = config.get('downloadFolder');
require("./db.js")

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

function downloadFile(url, folder){
    var ret = [];
    var len = 0;
    var zlib = require("zlib");

    request({
        url:url,
        gzip:true,
        headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
    }).on('response', function(res){
        var path = res.request.uri.path.split('/');
        var fileName = path[path.length-1];
        console.log(fileName)

        res.on('data', function (data) {
            ret.push(data);
            len += data.length;
        });

        res.on('end', function(){
            var buffer = Buffer.concat(ret, len);
            var encoding = res.headers['content-encoding'];
            var folderName = downloadFolder + folder + '/';
            if(!checkAndCreateFolder(folderName)){
                console.log('Error creating folder');
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
        });
    }).on('error', function(err) {
        console.log(err);
    });;
}

/********************Set some tasks for later *******************/
var agenda = new Agenda({db: { address: 'localhost:27017/agendaJobs'}});

agenda.define('update db', function(job, done) {
    var showsInDb = {};var day = moment.unix(1413632472);
    var requestShow = [];
    var timestamp = moment().subtract(1,'days').unix();
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
                                            newEpisode.save(function(err) {
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
    console.log('2');
    var downloadDays = config.get('downloadDays');
    if(!downloadDays || isNaN(parseInt(downloadDays))){
        downloadDays = 1;
    }
    console.log(downloadDays);
    async.waterfall([
        // find relevant episode in the db
        function(callback){
            var start = moment().subtract(downloadDays, 'days').hour(0).minute(0).toDate();
            var end = moment().toDate();
            console.log('Look for episode in range: ' + start + ' to ' + end);
            Episode.find({firstAired:{$gte:start, $lt:end}},function(err, results){
                _.each(results, function(r){
                    console.log('Found the following: ', r.episodeId + ':' + r.episodeName);
                })

                if(err) callback(err);
                if(results.length < 1) {
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
                console.log(url);
                //parse the show page in kickass torrents to get the episode number in the site
                request({
                    url: url.url,
                    gzip:true,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.104 Safari/537.36',
                        "cache-control":"no-cache",
                        "Accept":"text/html"
                    }
                },  function(error, response, body) {
                    var document = jsdom(body);
                    var window = document.parentWindow;
                    jsdom.jQueryify(window, "http://code.jquery.com/jquery-2.1.1.js", function () {
                        //console.log($(window.$.find('h3:contains("Season 0' + url.season + '")')).next('div').find('span:contains("Episode 0' + url.number + '")').parent().attr("onClick"));
                        console.log('h3:contains("Season 0' + url.season + '")');
                        console.log(response.statusCode)
                        var node = window.$(window.$.find('h3:contains("Season 0' + url.season + '")')).next('div').find('span:contains("Episode 0' + url.number + '")').parent().attr("onClick");
                        console.log(node)
                        var episodeUrlTorrent = node.split('\'')[1];
                        console.log(episodeUrlTorrent)
                        //go get the list of files related to this show
                        request({
                            url: 'https://kickass.to/media/getepisode/' + episodeUrlTorrent + '/',
                            gzip:true,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.104 Safari/537.36',
                                "cache-control":"no-cache",
                                "Accept":"text/html"
                            }
                        }, function(error, response1, body1) {
                            console.log("getting episodes" + response1.statusCode)
                            var document = jsdom(body1);
                            var window = document.parentWindow;
                            jsdom.jQueryify(window, "http://code.jquery.com/jquery-2.1.1.js", function () {
                                var node = window.$.find('a[title="Download torrent file"]')[0].href;
                                console.log(node)
                                console.log(url.name)
                                downloadFile(node, url.name);
                            });
                        });
                    });
                });
            });
            callback(null);
        }
    ], function (err, result) {
        if(err === 111){
            console.log('No episodes were found for today');
        }
        else if(err === 222){
            console.log('No links found in db');
        }
        else{
            console.log(err)
        }
        done();
    });
});
agenda.start();
agenda.every('24 hours', 'today shows');
agenda.every('24 hours', 'update db');
agenda.now('today shows')

/********************Set some tasks for later*******************/