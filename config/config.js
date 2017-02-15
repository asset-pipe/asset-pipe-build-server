/* jshint node: true, strict: true */
'use strict';

const path = require('path');
const fs = require('fs');
const convict = require('convict');
const pckage = require('../package.json');

// Configuration schema
const conf = convict({
    env: {
        doc: 'Applicaton environments',
        format: ['development', 'production'],
        default: 'development',
        env: 'NODE_ENV',
        arg: 'env',
    },

    version: {
        doc: 'Version of the application',
        format: String,
        default: pckage.version,
    },

    name: {
        doc: 'Name of the application',
        format: String,
        default: pckage.name,
    },

    httpServerPort: {
        doc: 'The port the server should bind to',
        format: 'port',
        default: 7100,
        env: 'PORT',
        arg: 'port',
    },

    logLevel: {
        doc: 'Which level the console transport log should log at',
        format: String,
        default: 'debug',
        env: 'LOG_LEVEL',
    },

});

// Load config files
if (fs.existsSync(path.resolve(__dirname, '../config/local.json'))) {
    conf.loadFile([path.resolve(__dirname, '../config/', `${conf.get('env')}.json`), path.resolve(__dirname, '../config/local.json')]);
} else {
    conf.loadFile([path.resolve(__dirname, '../config/', `${conf.get('env')}.json`)]);
}

// Validate all properties and export it
conf.validate();

module.exports = conf;
