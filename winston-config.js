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

winston.loggers.add('updaterLog', {
    console: {
        level: 'debug',
        colorize: 'true',
        label: 'updater logs'
    },
    file: {
        level:'debug',
        filename: 'logs/updaterLog.log',
        json:false
    }

});

winston.loggers.add('updaterError', {
    console: {
        level: 'debug',
        colorize: 'true',
        label: 'updater errors'
    },
    file: {
        level:'debug',
        filename: 'logs/updaterError.log',
        json:false
    }

});

winston.loggers.add('modulesLogger', {
    console: {
        level: 'debug',
        colorize: 'true',
        label: 'Modules'
    },
    file: {
        level:'debug',
        filename: 'logs/modulesLogger.log',
        json:false
    }

});