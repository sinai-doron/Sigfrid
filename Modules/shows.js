/**
 * Created by Doron Sinai on 21/11/2014.
 */
var _ = require('lodash');
var mongoose = require('mongoose');
require("../db.js");
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');
var Q  = require("q");
var winston = require('winston');
require('../winston-config.js');
var debugLogger = winston.loggers.get('all');
var errorLogger = winston.loggers.get('terror');
var moment = require('moment');

function getEpisodesByDateRange(start, end, callback){
    var query = Episode.find({firstAired:{$gte:start, $lt:end}});
    return getEpisodesFromDb(query, callback);
}

function getEpisodesForShowDaysBack(showId, numberOfDaysToLookBack, callback){
    var start = moment().subtract(numberOfDaysToLookBack, 'days').hour(0).minute(0).toDate();
    var end = moment().hour(0).minute(0).toDate();
    var query = Episode.find({showId:showId, firstAired:{$gte:start, $lt:end}});
    return getEpisodesFromDb(query, callback);
}

function getEpisodesFromDb(query, callback) {
    var defer = Q.defer();
    if (!query) {
        errorLogger.error('No query was passed, returning nothing');
        defer.reject("No query was passed, returning nothing");
        return;
    }
    if(query.model.modelName !== "Episode"){
        errorLogger.error('Query has to come from Episode Model');
        defer.reject("Query has to come from Episode Model");
        return;
    }
    query.sort({ season: '1', episodeNumber: 1 });
    query.exec(function(err, results){
        if(err){
            errorLogger.error('An error occurred ' + err);
            defer.reject("[getEpisodesFromDb] - Error occurred see logs");
            return;
        };
        _.each(results, function(r){
            debugLogger.info(r.showName + ": " + r.season + "x" + r.episodeNumber + " - " + r.episodeName)//'Found the following
        })
        if(results.length < 1) {
            debugLogger.info('No episode found for that date range');
            defer.reject("[getEpisodesFromDb] - No episode found for that date range");
            return;
        }
        if(callback && (typeof callback === "function")){
            defer.resolve(callback(results));
        }
        else{
            defer.resolve(results);
        }
    });
    return defer.promise;
}

function getShowUrl(episodes){
    var defer = Q.defer();
    var urls = [];
    var episodesToDownloadByShow = {};
    var showsNumbers = {}
    Show.find({},function(err,shows){
        if(err){
            errorLogger.error('[getShowUrl] An error occurred ' + err);
            defer.reject('[getShowUrl] An error occurred ');
            return;
        };

        for(var i=0; i <shows.length; i++){
            var o = {}
            o.url = shows[i].url;
            o.name = shows[i].name;
            showsNumbers[shows[i]._id] = o;
        }

        _.each(episodes,function(episode){
            var u;
            if(episodesToDownloadByShow[episode.showId]){
                u = episodesToDownloadByShow[episode.showId]
            }
            else{
                u = {
                    url : showsNumbers[episode.showId]["url"],
                    name : showsNumbers[episode.showId]["name"],
                    episodes : []
                }
                episodesToDownloadByShow[episode.showId] = u;
            }

            var e = {};
            e.season = episode.season;
            e.number = episode.episodeNumber;
            u.episodes.push(e);
            if(u.url && (u.url !== "")){
                urls.push(u);
            }
        });
        if(urls.length === 0){
            debugLogger.info("[getShowUrl] No urls found in shows objects");
            defer.reject('[getShowUrl] No urls found in shows objects');
            return;
        };
        defer.resolve(episodesToDownloadByShow);
    })

    return defer.promise;
}

module.exports = {
    getEpisodesFromDb : getEpisodesFromDb,
    getEpisodesByDateRange : getEpisodesByDateRange,
    getEpisodesForShowDaysBack : getEpisodesForShowDaysBack,
    getShowUrl : getShowUrl
}


/*
 Episode.find({firstAired:{$gte:start, $lt:end}},
Person
 .find({ occupation: /host/ })
 .where('name.last').equals('Ghost')
 .where('age').gt(17).lt(66)
 .where('likes').in(['vaporizing', 'talking'])
 .limit(10)
 .sort('-occupation')
 .select('name occupation')
 .exec(callback);*/