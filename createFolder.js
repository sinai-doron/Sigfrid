/**
 * Created by doron on 10/23/14.
 */
var mongoose = require('mongoose');
var config = require('config');
var downloadFolder = config.get('downloadFolder');
var fs = require('fs');
var _ = require('lodash');
require("./db.js");

var User = mongoose.model('User');
var Show = mongoose.model('Show');
var Episode = mongoose.model('Episode');

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

Show.find({},function(err, shows){
    _.each(shows,function(show){
        var name = show.name;
        console.log(name);
        console.log(checkAndCreateFolder(downloadFolder + name + '/'));
    });
    process.exit(1);
});

