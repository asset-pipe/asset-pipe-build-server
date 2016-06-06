/* jshint node: true, strict: true */

"use strict";

const http            = require('http'),
      hbs             = require('hbs'),
      path            = require('path'),
      bole            = require('bole'),
      express         = require('express'),
      compress        = require('compression')(),
      cors            = require('cors'),
      config          = require('../config/config.js'),
      ErrorMid        = require('error-mid'),
//      log             = require('./log.js'),
      Lib             = require('../'),
      app             = express(),
      errorMid        = new ErrorMid();



// Configure logging

bole.output({
    level: config.get('logLevel'),
    stream: process.stdout
});



// Set up handlebars as template engine

hbs.registerPartials(path.resolve(__dirname, '../views/partials/'));
app.set('view engine', 'hbs');
app.set('views', [path.resolve(__dirname, '../views/'), errorMid.views()]);



// Set up the library this app exposes

const lib = new Lib();



// Configure application

app.disable('x-powered-by');
app.enable('trust proxy');



// Set middleware

app.use(compress);
app.use(cors());



// Attach lib routers 

app.use('/', lib.routes);



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
