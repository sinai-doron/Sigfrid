/**
 * Created by doron on 10/29/14.
 */
var moment = require('moment');
var mongoose = require('mongoose');
var request = require('request');
var xml2js = require('xml2js');
var winston = require('winston');
require('./winston-config.js');
var config = require('config');
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
    var updateDays = config.get('updateDays') || 1;
    var timestamp = moment().subtract(updateDays,'days').unix();
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
        debugLogger.info('going to ask for updates, from: ' +  moment.unix(timestamp).toDate() + ', ' + moment().toDate());
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
                            _.each(episodes,function(e){
                                var found = false;
                                var foundEpisode = null;
                                for(var i=0; i<show.episodes.length;i++){
                                    if(show.episodes[i].episodeId === e.id){
                                        found = true;
                                        foundEpisode = show.episodes[i];
                                        break;
                                    }
                                }
                                if(found){
                                    if(foundEpisode !== null){
                                        if(foundEpisode.episodeName !== e.episodename){
                                            debugLogger.info('[' + show.name + '] - old episode name: ' + foundEpisode.episodeName + ' , new episode name: ' + e.episodename);
                                        }
                                        if(moment(e.firstaired).isValid() && moment(foundEpisode.firstAired).diff(moment(e.firstaired), 'days') !== 0){
                                            debugLogger.info('[' + show.name + '] - old episode airdate: ' + moment(foundEpisode.firstAired).toDate() + ' , new episode airdate: ' + moment(e.firstaired).toDate());
                                            debugLogger.info();
                                        }
                                        foundEpisode.season = e.seasonnumber;
                                        foundEpisode.episodeNumber = e.episodenumber;
                                        foundEpisode.episodeName = e.episodename;
                                        foundEpisode.firstAired = e.firstaired;
                                        foundEpisode.overview = e.overview;

                                        foundEpisode.save(function(err) {
                                            if (err) {
                                                errorLogger.error("Error saving episode after updating " + err);
                                            }
                                        });

                                    }else{
                                        errorLogger.error("found episode but element was null");
                                    }
                                }
                                else{
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

function addUpdaterJob(agenda){
    agenda.define('update db', function(job, done) {
        updateDb();
        done()

    });
}


module.exports = addUpdaterJob;