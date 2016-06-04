/* jshint node: true, strict: true */

"use strict";

const   path    = require('path'),
        fs      = require('fs'),
        Env     = require('@amedia/api-environment'),
        convict = require('convict'),
        pckage  = require('../package.json');



// Load API environment

const env = new Env();
env.load();



// Configuration schema

let conf = convict({
    env: {
        doc     : "Applicaton environments",
        format  : ["development", "production"],
        default : "development",
        env     : "NODE_ENV",
        arg     : "env"
    },

    version: {
        doc     : "Version of the application",
        format  : String,
        default : pckage.version
    },

    name: {
        doc     : "Name of the application",
        format  : String,
        default : pckage.name
    },

    serverType: {
        doc     : "Which type of server this is - might be overrided by API environment",
        format  : String,
        default : 'dev',
        env     : 'API_SERVER_TYPE'
    },

    serverName: {
        doc     : "The name of the server - might be overrided by API environment",
        format  : String,
        default : 'dev',
        env     : 'API_SERVER_NAME'
    },

    serverRole: {
        doc     : "The role of this server - might be overrided by API environment",
        format  : String,
        default : 'dev',
        env     : 'API_SERVER_ROLE'
    },

    backendType: {
        doc     : "Which type of backend this is - might be overrided by API environment",
        format  : String,
        default : 'dev',
        env     : 'API_BACKEND_TYPE'
    },

    contextPath: {
        doc     : "Context path for the application. Serves as a prefix for the paths in all URLs",
        format  : String,
        default : '/' + pckage.name
    },

    apiPath: {
        doc     : "The prefix for all API routes intended to be accessed by the browser",
        format  : String,
        default : "/api/" + pckage.name
    },

    httpServerPort: {
        doc     : "The port the server should bind to",
        format  : "port",
        default : 7100,
        env     : "PORT",
        arg     : "port"
    },

    docRoot: {
        doc     : "Document root for static files to be served by the http server",
        format  : String,
        default : "public"
    },

    consoleLogLevel: {
        doc     : "Which level the console transport log should log at",
        format  : String,
        default : "debug",
        env     : "LOG_LEVEL",
    },

    statsdServer: {
        doc     : 'Where to send StatsD metrics',
        format  : String,
        default : 'localhost',
        env     : 'STATSD_HOST'
    },

    statsdPort: {
        doc     : 'The port statsD is listening to',
        format  : 'port',
        default : 8125,
        env     : 'STATSD_PORT'
    }
});



// Load config files

if (fs.existsSync(path.resolve(__dirname, '../config/local.json'))) {
    conf.loadFile([path.resolve(__dirname, '../config/', conf.get('env') + '.json'), path.resolve(__dirname, '../config/local.json')]);
} else {
    conf.loadFile([path.resolve(__dirname, '../config/', conf.get('env') + '.json')]);
}



// Set values, if any, from API environment

if (env.get('server.type')) {conf.set('serverType', env.get('server.type'));}
if (env.get('server.name')) {conf.set('serverName', env.get('server.name'));}
if (env.get('server.role')) {conf.set('serverRole', env.get('server.role'));}
if (env.get('backend.type')) {conf.set('backendType', env.get('backend.type'));}



// Validate all properties and export it

conf.validate();

module.exports = conf;
