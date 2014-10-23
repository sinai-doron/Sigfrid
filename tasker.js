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
require("./db.js")

var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
});
var apiKey = '94110B1EA4F695E8'; //API key from the tv db
var User = mongoose.model('User');
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');
function downloadFile(url){
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
            if (encoding == 'gzip') {
                zlib.gunzip(buffer, function(err, decoded) {
                    var wstream = fs.createWriteStream(fileName);
                    wstream.write(decoded);
                    wstream.end();
                });
            } else if (encoding == 'deflate') {
                zlib.inflate(buffer, function(err, decoded) {
                    var wstream = fs.createWriteStream(fileName);
                    wstream.write(decoded);
                    wstream.end();
                })
            } else {
                var wstream = fs.createWriteStream(fileName);
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
    async.waterfall([
        // find relevant episode in the db
        function(callback){
            var start = moment().subtract(1, 'days').hour(0).minute(0).toDate();
            var end = moment().toDate();
            console.log('Look for episode in range: ' + start + ' to ' + end);
            Episode.find({firstAired:{$gte:start, $lt:end}},function(err, results){
                console.log('Found the following: ', results);
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
            Show.find({},function(err,shows){
                if(err) callback(err);
                var allUrls = shows.map(function (m) {
                    var obj = {};
                    obj['url'] = m.url;
                    obj[m._id] = m.url;
                    return obj;
                });
                _.each(episodes,function(episode){
                    for(var i=0; i < allUrls.length; i++){
                        if(allUrls[i][episode.showId] !== undefined){
                            allUrls[i]['season'] = episode.season;
                            allUrls[i]['number'] = episode.episodeNumber;
                            urls.push(allUrls[i]);
                        }
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
                        var node = window.$(window.$.find('h3:contains("Season 0' + url.season + '")')).next('div').find('span:contains("Episode 0' + url.number + '")').parent().attr("onClick");
                        var episodeUrlTorrent = node.split('\'')[1];

                        //go get the list of files related to this show
                        request({
                            url: 'https://kickass.to/media/getepisode/' + episodeUrlTorrent + '/',
                            gzip:true,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.104 Safari/537.36',
                                "cache-control":"no-cache",
                                "Accept":"text/html"
                            }
                        }, function(error, response, body) {
                            var document = jsdom(body);
                            var window = document.parentWindow;
                            jsdom.jQueryify(window, "http://code.jquery.com/jquery-2.1.1.js", function () {
                                var node = window.$.find('a[title="Download torrent file"]')[0].href;
                                downloadFile(node);
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
//agenda.now('today shows');
agenda.now('update db');
//agenda.now('today shows');
//agenda.start();
//agenda.every('1 Hours', 'today shows');

/********************Set some tasks for later*******************/