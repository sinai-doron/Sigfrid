/**
 * Created by doron on 10/21/14.
 */
var http = require('http');
var fs = require('fs');

var file = fs.createWriteStream("download.torrent");
var request = http.get("http://torcache.net/torrent/608567F8270EA12AD18CDDEB92024E8872A99948.torrent", function(response) {
    response.pipe(file);
});