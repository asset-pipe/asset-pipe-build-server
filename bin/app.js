/* jshint node: true, strict: true */

"use strict";

const http            = require('http'),
      hbs             = require('hbs'),
      path            = require('path'),
      express         = require('express'),
      compress        = require('compression')(),
      cors            = require('cors'),
      config          = require('../config/config.js'),
      ErrorMid        = require('error-mid'),
      metrics         = require('@amedia/statsd-metrics'),
      log             = require('./log.js'),
      Lib             = require('../'),
      app             = express(),
      errorMid        = new ErrorMid();



// Set up handlebars as template engine

hbs.registerPartials(path.resolve(__dirname, '../views/partials/'));
app.set('view engine', 'hbs');
app.set('views', [path.resolve(__dirname, '../views/'), errorMid.views()]);



// Set up the library this app exposes

const lib = new Lib();



// Set up metrics

metrics({
    host : config.get('statsdServer'),
    port : config.get('statsdPort'),
    name : config.get('name'),
    serverName : config.get('serverName'),
    serverType : config.get('serverType')
}, (error) => {
    log.error(error, 'error setting up metrics');
});


// Configure application

app.disable('x-powered-by');
app.enable('trust proxy');



// Set middleware

app.use(metrics.middleware);
app.use(compress);
app.use(cors());



// Attach lib routers 
console.log(config.get('apiPath') + '/v1');
app.use(config.get('apiPath') + '/v1', lib.routes);
app.get(config.get('contextPath') + '/apiadmin/ping', (req, res) => {
    res.status('200 OK ' + config.get('version')).send('OK ' + config.get('version'));
});



// Log errors

app.use((error, req, res, next) => {
    log.error(error);
    next(error);
});


/*
// Send error status pages

app.use(errorMid.middleware());



// Catch all requests which fall through the 
// middleware chain, not matching any routes,
// and serve a 404 page

app.use(errorMid.response({code : 404, message : 'File Not Found'}));
*/


// Set up http server and Export application

module.exports = http.createServer(app);
