/**
 * Created by doron on 10/21/14.
 */
var http = require('http');
var fs = require('fs');
var request = require('request');
var config = require('config');

var dbConfig = config.get('downloadFolder');
console.log(dbConfig);