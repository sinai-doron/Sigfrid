/**
 * Created by doron on 10/29/14.
 */
var moment = require('moment');
var mongoose = require('mongoose');
var request = require('request');
var xml2js = require('xml2js');
var winston = require('winston');
require('./winston-config.js');
var debugLogger = winston.loggers.get('updaterLog');
var errorLogger = winston.loggers.get('updaterError');
var _ = require('lodash');
var Q = require('q');
var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
});
require('./db.js')
var apiKey = '94110B1EA4F695E8'; //API key from the tv db
var User = mongoose.model('User');
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');

function getSeriesFromTvDb(seriesId){
    var defer = Q.defer();

    request.get('http://thetvdb.com/api/' + apiKey + '/series/' + seriesId + '/all/en.xml', function(error, response, body) {
        if (error) {
            errorLogger.error(error);
            defer.reject("request error");
            return;
        }
        parser.parseString(body, function (err, result) {
            if (err){
                defer.reject("parser error");
            }
            var series = result.data.series;
            var episodes = result.data.episode;
            defer.resolve({series:series, episodes:episodes})
        })
    });

    return defer.promise;
}

function updateDb(){
    var showsInDb = {};
    var timestamp = moment().subtract(1,'days').unix();
    var defer = Q.defer();
    Show.find({},function(err, shows){
        if(err) {
            errorLogger.error(err);
            return;
        }
        _.each(shows, function(show){
            showsInDb[show._id] = show.name;
        });
        debugLogger.info(JSON.stringify(showsInDb));
        debugLogger.info('going to ask for changes, from: ' + timestamp + ', ' + moment.unix(timestamp).toDate());
        request.get('http://thetvdb.com/api/Updates.php?type=all&time='+timestamp, function(error, response, body) {
            if (error) {
                errorLogger.error(error);
                return;
            }
            parser.parseString(body, function(err, result) {
                if (err) {
                    errorLogger.error(err);
                    return;
                }
                var updatedEpisodes = result.items.episode;
                var updatedSeries = result.items.series;
                defer.resolve({updatedEpisodes: updatedEpisodes, updatedSeries: updatedSeries});
            });
        })
    });
    defer.promise.then(function(data){
        var updatedSeries = data.updatedSeries;
        var updatedEpisodes = data.updatedEpisodes;
        var updatedEpisodesHash = {};
        _.each(updatedEpisodes,function(e){
            updatedEpisodesHash[e] = 1
        });
        _.each(updatedSeries, function(ser){
            if(showsInDb[ser]){
                debugLogger.info(showsInDb[ser] + " has updates");
                Show.findById(ser)
                    .populate('episodes', null, null, {sort:{'season':1, 'episodeNumber':1}})
                    .exec(function(err, show) {
                        if(err) {
                            errorLogger.error(err);
                            return;
                        }
                        getSeriesFromTvDb(ser).then(function(data){
                            var series = data.series;
                            var episodes = data.episodes;
                            _.each(show.episodes,function(e){
                                if(updatedEpisodesHash[e.episodeId])
                                    console.log('++++++', e.episodeId, e.episodeName);
                            });
                            _.each(episodes,function(e){
                                var found = false;
                                for(var i=0; i<show.episodes.length;i++){
                                    if(show.episodes[i].episodeId === e.id){
                                        found = true;
                                        break;
                                    }
                                }
                                if(!found){
                                    console.log('------', e.id, e.episodename, show.name);
                                    var newEpisode = new Episode({
                                        episodeId: e.id,
                                        showId:show._id,
                                        showName: show.name,
                                        season: e.seasonnumber,
                                        episodeNumber: e.episodenumber,
                                        episodeName: e.episodename,
                                        firstAired: e.firstaired,
                                        overview: e.overview,
                                        watched: false,
                                        absoluteNumber:e["absolute_number"],
                                        imageLocation:e["filename"],
                                        thumbHeight:e["thumb_height"],
                                        thumbWidth:e["thumb_width"]
                                    })
                                    show.episodes.push(newEpisode._id);
                                    newEpisode.save(function(err) {
                                        if (err) {
                                            console.log(err);
                                        }
                                        show.save(function(err) {
                                            if (err) {
                                                console.log(err);
                                            }
                                        });
                                    });
                                }
                            });
                        });
                    });
            }
        });
    });
}

updateDb();


function addUpdaterJob(agenda){
    agenda.define('update db', function(job, done) {
        var showsInDb = {};
        var timestamp = moment().subtract(6,'days').unix();
        Show.find({},function(err, shows){
            if(err) {
                errorLogger.error(err);
                return;
            }
            _.each(shows, function(show){
                showsInDb[show._id] = 1;
            });
            debugLogger.info(showsInDb);
            debugLogger.info('going to ask for changes, from: ' + timestamp + ', ' + moment.unix(timestamp).toDate());
            request.get('http://thetvdb.com/api/Updates.php?type=series&time='+timestamp, function(error, response, body) {
                if (error) {
                    errorLogger.error(error);
                    return;
                }
                parser.parseString(body, function(err, result) {
                    if(err) {
                        errorLogger.error(err);
                        return;
                    }
                    _.each(result.items.series, function(series){
                        if(showsInDb[series]){
                            debugLogger.info('found: ' + series);
                            request.get('http://thetvdb.com/api/' + apiKey + '/series/' + series + '/all/en.xml', function(error, response, body) {
                                if (error) {
                                    errorLogger.error(error);
                                    return;
                                }
                                parser.parseString(body, function(err, result) {
                                    var series = result.data.series;
                                    var episodes = result.data.episode;

                                    _.each(episodes, function(episode) {
                                        Episode.findOne({
                                            episodeId:episode.id
                                        },function(err, episode1){
                                            if(err) errorLogger.error('An error as occured: ' + err);
                                            if(!episode1){
                                                debugLogger.info('new episode saved'.blue);
                                                var newEpisode = new Episode({
                                                    episodeId: episode.id,
                                                    showId:series.id,
                                                    showName:series.name,
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
                                                debugLogger.info(newEpisode.episodeId + ' ' + newEpisode.episodeName);
                                                newEpisode.save(function(err,episode) {
                                                    Show.findById(series.id,function(err, show){
                                                        show.episodes.push(episode._id);
                                                        show.save(function(){})
                                                    });
                                                    if (err) {
                                                        errorLogger.error(err);
                                                    }
                                                });
                                            }
                                            else{
                                                //console.log('episode: '+episode.id + ' found in db')
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
}


module.exports = addUpdaterJob;