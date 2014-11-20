/**
 * Created by Doron Sinai on 20/11/2014.
 */
var winston = require('winston');
require('../winston-config.js');
var debugLogger = winston.loggers.get('all');
var errorLogger = winston.loggers.get('terror');
var zlib = require("zlib");
var request = require('request');
var fs = require('fs');
var Q = require('q');

function checkAndCreateFolder(folder){
    if(fs.existsSync(folder)){
        return true;
    }
    else{
        fs.mkdirSync(folder);
        if(fs.existsSync(folder)){
            return true;
        }
        return false;
    }
}

function downloadFile(url, folder, downloadFolder){
    var defer = Q.defer();
    var ret = [];
    var len = 0;
    if (!downloadFolder){
        downloadFolder = "";
        debugLogger.info('Did not find download folder, going to save her instead');
    }
    if(!folder){
        folder = "defaultfolder";
        debugLogger.info('Did not find a folder to save the file in going to save it in defaultFolder instead');
    }
    debugLogger.info('Going to download from the following URL: ' + url);
    debugLogger.info('and save it in this folder: ' + folder);
    request({
        url:url,
        gzip:true,
        headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
    }).on('response', function(res){
        var path = res.request.uri.path.split('/');
        var fileName = path[path.length-1];
        debugLogger.info('Giving it this filename: ' + fileName);

        res.on('data', function (data) {
            ret.push(data);
            len += data.length;
        });

        res.on('end', function(){
            var buffer = Buffer.concat(ret, len);
            var encoding = res.headers['content-encoding'];
            var folderName = downloadFolder + folder + '/';
            if(!checkAndCreateFolder(folderName)){
                errorLogger.error('Can not create folders');
                defer.reject("Error creating folders");
                return;
            }
            var wstream = fs.createWriteStream(folderName + fileName);
            if (encoding == 'gzip') {
                zlib.gunzip(buffer, function(err, decoded) {
                    wstream.write(decoded);
                    wstream.end();
                });
            } else if (encoding == 'deflate') {
                zlib.inflate(buffer, function(err, decoded) {
                    wstream.write(decoded);
                    wstream.end();
                })
            } else {
                wstream.write(buffer.toString());
                wstream.end();
            }
            defer.resolve({
                status:"success",
                filename:fileName
            })
        });
    }).on('error', function(err) {
        errorLogger.error('Error while trying to save file ' + err);
        defer.reject("Error downloading file");
    });

    return defer;
}

module.exports = {
    downloadFile: downloadFile,
    checkAndCreateFolder:checkAndCreateFolder
}