/**
 * Created by doron on 10/28/14.
 */
var request = require('request');
var jsdom = require("jsdom");
var Q = require('q');
var debugLogger = {
    info: console.log
}


var url = { season: 2,
    number: 6,
    url: 'https://kickass.to/the-blacklist-tv35048/',
    name: 'The Blacklist' }

function requestSeriesPage(url){
    var finishedRequest = Q.defer();
    var finishedRequestPromise = finishedRequest.promise;
    debugLogger.info('[' + url.url + '] ' + 'Going to request the page');

    request({
        url: url.url,
        gzip:true
    },  function(error, response, body) {
        debugLogger.info('[' + url.url + '] ' + 'Got a response back with status: ' + response.statusCode);
        if (!error && response.statusCode == 200) {
            debugLogger.info('[' + url.url + '] ' + 'About to parse the dom');
            jsdom.env(
                body,
                ["./jquery-2.1.1.min.js"],
                function (errors, window) {
                    if(errors) {
                        console.log(errors);
                        finishedRequest.reject();
                        return;
                    }
                    var node = window.$(window.$.find('h3:contains("Season 0' + url.season + '")')).next('div').find('span:contains("Episode 0' + url.number + '")').parent().attr("onClick");
                    if(node && node.length > 1){
                        var episodeUrlTorrent = node.split('\'')[1];
                        if(episodeUrlTorrent){
                            debugLogger.info('[' + url.url + '] ' + 'Found the following episode number: ' + episodeUrlTorrent);
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
            console.log(error);
            finishedRequest.reject();
        }
    });

    //do it next
    finishedRequestPromise.then(function(episodeNumber){
        requestEpisodeSegment(episodeNumber);
    }, function(){
        console.log(arguments);
    }, function(){});  //.then(onFulfilled, onRejected, onProgress)
}

function requestEpisodeSegment(episodeNumber){
    var url = 'https://kickass.to/media/getepisode/' + episodeNumber + '/';
    var finishedRequest = Q.defer();
    var finishedRequestPromise = finishedRequest.promise;

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
                        console.log(errors);
                        finishedRequest.reject();
                        return;
                    }
                    var node = window.$(window.$.find('tr:contains("x264")')).find(('a[title="Download torrent file"]'));
                    if (node.length < 1){
                        node = window.$.find('a[title="Download torrent file"]');
                        console.log("No x264 torrents found in page");
                        if(node.length < 1){
                            console.log("No torrents found - rejecting defer obj");
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
            console.log(error);
            finishedRequest.reject();
        }
    });

    //do it next
    finishedRequestPromise.then(function(nodeUrl){
        console.log(nodeUrl);
    }, function(){
        console.log(arguments);
    }, function(){});  //.then(onFulfilled, onRejected, onProgress)
}




requestSeriesPage(url);








/*request({
    url: 'https://kickass.to/media/getepisode/' + episodeUrlTorrent + '/',
    gzip:true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.104 Safari/537.36',
        "cache-control":"no-cache",
        "Accept":"text/html"
    }
}, function(error, response1, body1) {
    var document1 = jsdom(body1);
    var window1 = document1.parentWindow;
    jsdom.jQueryify(window1, "http://code.jquery.com/jquery-2.1.1.js", function () {
        //var node = window.$.find('a[title="Download torrent file"]')[0].href;
        var node = window1.$(window1.$.find('tr:contains("x264")')).find(('a[title="Download torrent file"]'));
        if (node.length < 1){
            node = window1.$.find('a[title="Download torrent file"]');
            url.deferred.reject("No x264 torrents found in page ");
            if(node.length < 1){
                url.deferred.reject("No torrents found ");
                return;
            }
        }
        var nodeUrl = node[0].href;
        var downloadfileDefer = Q.defer();
        url.deferred.resolve(downloadfileDefer.promise);
        downloadFile(nodeUrl, url.name, downloadfileDefer);
    });
});*/