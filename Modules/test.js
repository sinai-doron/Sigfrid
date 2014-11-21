/**
 * Created by Doron Sinai on 20/11/2014.
 */
var _ = require('lodash');
var mongoose = require('mongoose');
require("../db.js");
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');
var winston = require('winston');
var moment = require('moment');
require('../winston-config.js');
var debugLogger = winston.loggers.get('modulesLogger');

var downloader = require('./downloader');
var shows = require('./shows');
var kickass = require('./kickass');

var testFolder = "testFolder";
var testUrl = "http://torcache.net/torrent/D9CC0C94FBB1D990D2369930A1FC66F7F7BB0E10.torrent?title=[kickass.to]brooklyn.nine.nine.s02e04.hdtv.x264.killers.eztv"
var downloadFolder = "";

var start = moment().subtract(30, 'days').hour(0).minute(0).toDate();
var end = moment().hour(0).minute(0).toDate();
var episodeQuery = Episode.find({firstAired:{$gte:start, $lt:end}});
//shows.getEpisodesFromDb(episodeQuery);
//shows.getEpisodesFromDb(Episode.find({showName:"Modern Family"}))
//281630

//step 1 - get the episodes you want from the DB
//var deferEpisodes = shows.getEpisodesForShowDaysBack(281630, 90, shows.getShowUrl);
var deferEpisodes = shows.getEpisodesByDateRange(start, end, shows.getShowUrl);
deferEpisodes.then(function(results){
    kickass.getTorrentFilesLinks(results).then(function(values){
        console.log('we got ome:')
      console.log(values);
        //if we find some url lets get the torrents
        _.each(values,function(v){
            if(v.state === "rejectted"){
                console.log("No episodes because:" + v.value);
                return;
            }
            _.each(v.value,function(obj){
                downloader.downloadFile(obj.url,obj.name, downloadFolder);
            })
        })
    },function(reason){console.log(reason)},function(){})
},function(reason){console.log(reason)},function(){})

//step 2 - get the torrents files url

//step 3 - download torrents files
/*downloader.checkAndCreateFolder(testFolder);
var defer = downloader.downloadFile(testUrl,testFolder, downloadFolder);

defer.promise.then(function(obj){
    console.log('Great success', JSON.stringify(obj));
},function(reason){
    console.log('The great failure', reason);
},function(){}) //.then(onFulfilled, onRejected, onProgress)*/