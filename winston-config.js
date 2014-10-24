/**
 * Created by Doron Sinai on 24/10/2014.
 */
var winston = require('winston');

winston.loggers.add('all', {
    console: {
        level: 'debug',
        colorize: 'true',
        label: 'tasker debug'
    },
    file: {
        level:'debug',
        filename: 'logs/debug.log',
        json:false
    }

});

winston.loggers.add('terror', {
    console: {
        level: 'debug',
        colorize: 'true',
        label: 'tasker errors'
    },
    file: {
        level:'debug',
        filename: 'logs/errors.log',
        json:false
    }

});