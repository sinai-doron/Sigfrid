/**
 * Created by Doron Sinai on 20/11/2014.
 */
var _ = require('lodash');
var mongoose = require('mongoose');
require("../db.js");
var Q = require("q");
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');
var winston = require('winston');
require('../winston-config.js');
var debugLogger = winston.loggers.get('all');
var errorLogger = winston.loggers.get('terror');
var moment = require('moment');
var request = require('request');
var jsdom = require("jsdom").jsdom;

function requestSeriesPage(show){
        var debugMessagePrefix = '[' + show.name + '] ';
        var finishedRequest = Q.defer();
        var finishedRequestPromise = finishedRequest.promise;

        debugLogger.info(debugMessagePrefix + 'Going to request the page');

        request({
            url: show.url,
            gzip:true
        },  function(error, response, body) {
            var episodeUrlTorrentsLinks = [];
            debugLogger.info(debugMessagePrefix + 'Got a response back with status: ' + response.statusCode);
            if (!error && response.statusCode == 200) {
                debugLogger.info(debugMessagePrefix + 'About to parse the dom');
                jsdom.env(
                    body,
                    ["../jquery-2.1.1.min.js"],
                    function (errors, window) {
                        if(errors) {
                            errorLogger.error(errors);
                            finishedRequest.reject("JSDOM error - see logs");
                            return;
                        }
                        _.each(show.episodes,function(e){
                            if(e.number < 10){
                                e.number = '0' + e.number;
                            }
                            var node = window.$(window.$.find('h3:contains("Season 0' + e.season + '")')).next('div').find('span:contains("Episode ' + e.number + '")').parent().attr("onClick");
                            if(node && node.length > 1){
                                var episodeUrlTorrent = node.split('\'')[1];
                                if(episodeUrlTorrent){
                                    debugLogger.info(debugMessagePrefix + 'Found the following episode number: ' + episodeUrlTorrent);
                                    episodeUrlTorrentsLinks.push(episodeUrlTorrent);
                                }
                            }
                            else{
                                finishedRequest.reject("Did not find season in page");
                            }
                        });
                        finishedRequest.resolve(episodeUrlTorrentsLinks);
                    }
                );
            }
            else{
                errorLogger.error(error);
                finishedRequest.reject();
            }
        });

        //do it next
        finishedRequestPromise.then(function(episodeNumberArray){
            console.log(episodeNumberArray);
            var promises = [];
            _.each(episodeNumberArray,function(e){
                var deferred = Q.defer();
                promises.push(deferred.promise);
                requestEpisodeSegment({episodeNumber: e, debugMessagePrefix:debugMessagePrefix, name:show.name, deferred:deferred});
            });
            Q.allSettled(promises).spread(function(){
                var args = arguments;
                var torrentsUrls = [];
                for(var i=0; i<args.length; i++){
                    var promise = args[i];
                    if(promise.state !== "fulfilled"){
                        show.deferred.reject("");
                        return;
                    }
                    torrentsUrls.push({url: promise.value, name: show.name})
                }
                show.deferred.resolve(torrentsUrls);
            }).done();


            //resolve the overaall defer here
        }, function(reason){
            errorLogger.error(reason);
            show.deferred.reject(reason);
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
                ["../jquery-2.1.1.min.js"],
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
        episode.deferred.resolve(nodeUrl);
    }, function(reason){
        errorLogger.error(reason);
        episode.deferred.reject(reason);
    }, function(){});  //.then(onFulfilled, onRejected, onProgress)
}

function getTorrentFilesLinks(episodes){
    var defer = Q.defer();
    var torrentFilesLinks = [];
    var promises = [];
    _.each(episodes,function(e){
        if(e.url){
            debugLogger.info('Try and get torrent file url for: ' + e.name + ' - ' + e.url);
            var deferred = Q.defer();
            promises.push(deferred.promise);
            e.deferred = deferred;
            console.log(e);
            requestSeriesPage(e);
        }
    })

    Q.allSettled(promises).spread(function(){
        var args = arguments;
        defer.resolve(args);
    }).done();

    //this API will return a array of object each containing a url and the name of the show or the reason why it failed
    return defer.promise;
}

module.exports = {
    getTorrentFilesLinks:getTorrentFilesLinks,
    requestSeriesPage:requestSeriesPage,
    requestEpisodeSegment:requestEpisodeSegment
}