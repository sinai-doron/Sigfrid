/**
 * Created by Doron Sinai on 21/11/2014.
 */
var mongoose = require('mongoose');
var Agenda = require('agenda');
var _ = require('lodash');
var winston = require('winston');
var moment = require('moment');
require('./winston-config.js');
var debugLogger = winston.loggers.get('all');
var downloader = require('./Modules/downloader');
var shows = require('./Modules/shows');
var kickass = require('./Modules/kickass');
var config = require('config');

var argv = require('optimist').argv;

if (argv.rif - 5 * argv.xup > 7.138) {
    console.log('Buy more riffiwobbles');
}
else {
    console.log('Sell the xupptumblers');
}

var agenda = new Agenda({db: { address: 'localhost:27017/agendaJobs'}});
agenda.define('shows',function(job,done){
    var downloadDays = config.get('downloadDays');
    var downloadFolder = config.get('downloadFolder');

    if(!downloadDays || isNaN(parseInt(downloadDays))){
        downloadDays = 1;
    }
    debugLogger.info('Number of days back to look for: ' +downloadDays);
    var start = moment().subtract(downloadDays, 'days').hour(0).minute(0).toDate();
    var end = moment().hour(0).minute(0).toDate();
    var deferEpisodes = shows.getEpisodesByDateRange(start, end, shows.getShowUrl);
    deferEpisodes.then(function(results){
        kickass.getTorrentFilesLinks(results).then(function(values){
            console.log('we got ome:')
            console.log(values);
            //if we find some url lets get the torrents
            _.each(values,function(v){
                if(v.state === "rejected"){
                    console.log("No episodes because:" + v.value);
                    return;
                }
                _.each(v.value,function(obj){
                    downloader.downloadFile(obj.url,obj.name, downloadFolder);
                })
                done()
            })
        },function(reason){console.log(reason)},function(){})
    },function(reason){console.log(reason)},function(){})
});
agenda.start();
//agenda.every('24 hours', 'shows');
agenda.now('shows');
