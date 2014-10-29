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
var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
});
var apiKey = '94110B1EA4F695E8'; //API key from the tv db
var User = mongoose.model('User');
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');

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