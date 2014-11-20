/**
 * Created by Doron Sinai on 20/11/2014.
 */
var downloader = require('./downloader');

var testFolder = "testFolder";
var testUrl = "http://torcache.net/torrent/D9CC0C94FBB1D990D2369930A1FC66F7F7BB0E10.torrent?title=[kickass.to]brooklyn.nine.nine.s02e04.hdtv.x264.killers.eztv"
var downloadFolder = "";

downloader.checkAndCreateFolder(testFolder);
var defer = downloader.downloadFile(testUrl,testFolder, downloadFolder);

defer.promise.then(function(obj){
    console.log('Great success', JSON.stringify(obj));
},function(reason){
    console.log('The great failure', reason);
},function(){}) //.then(onFulfilled, onRejected, onProgress)