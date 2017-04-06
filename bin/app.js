'use strict';

const http = require('http');
const bole = require('bole');
const express = require('express');
const compress = require('compression')();
const cors = require('cors');
const config = require('../config/config.js');
const Lib = require('../');

const app = express();
const log = bole('app');

// Configure logging
bole.output({
    level: config.get('logLevel'),
    stream: process.stdout,
});

// Set up the library this app exposes
const lib = new Lib();
lib.on('request start', (id, method, path) => {
    log.info('request start', id, method, path);
});
lib.on('request error', (id, method, path, error) => {
    log.info('request error', id, method, path, error);
});
lib.on('request success', (id, method, path, meta) => {
    log.info('request success', id, method, path, meta);
});

// Configure application
app.disable('x-powered-by');
app.enable('trust proxy');

// Set middleware
app.use(compress);
app.use(cors());

// Attach lib routers
app.use('/', lib.router());

// Log errors
app.use((error, req, res, next) => {
    log.error(error);
    next(error);
});

// Send error status pages
app.use((error, req, res, next) => { // eslint-disable-line
    const accepts = req.xhr ? 'json' : req.accepts(['html', 'json', 'text']);
    switch (accepts) {
        case 'json':
            res.status(error.output.payload.statusCode).json(error.output.payload);
            break;
        case 'html':
            res.status(error.output.payload.statusCode).send(`<html><body><h1>${error.output.payload.error}</h1></body></html>`);
            break;
        case 'text':
            res.status(error.output.payload.statusCode).send(error.output.payload.error);
            break;
        default:
            res.status(406).send('Not Acceptable');
    }
});

// Send 404 page
app.use((req, res) => {
    const accepts = req.xhr ? 'json' : req.accepts(['html', 'json', 'text']);
    switch (accepts) {
        case 'json':
            res.status(404).json({ code: 404, message: 'Not found' });
            break;
        case 'html':
            res.status(404).send('<html><body><h1>Not found</h1></body></html>');
            break;
        case 'text':
            res.status(404).send('Not found');
            break;
        default:
            res.status(406).send('Not Acceptable');
    }
});

// Set up http server and Export application
module.exports = http.createServer(app);
