'use strict';

const EventEmitter = require('events');
const express = require('express');
const SinkFs = require('asset-pipe-sink-fs');
const Reader = require('asset-pipe-js-reader');
const body = require('body/json');
const boom = require('boom');
const uuid = require('uuid/v4');

const params = require('./params');
const schemas = require('./schemas');


module.exports = class Router extends EventEmitter {
    constructor (sink) {
        super();

        this.sink = sink ? sink : new SinkFs({
            path: './public',
        });

        this.app = express.Router(); // eslint-disable-line

        this.app.use((req, res, next) => {
            res.locals.track = uuid();
            this.emit('request start', res.locals.track, req.method, req.path);
            next();
        });

        this.app.param('file', params.file);

        this.app.post('/feed', this.postFeedPersistCallback(),
                               this.postFeedResponseCallback());

        this.app.get('/feed/:file', this.getFileCallback());

        this.app.post('/bundle', this.postBundleParseCallback(),
                                 this.postBundleValidateCallback(),
                                 this.postBundlePersistCallback(),
                                 this.postBundleResponseCallback());

        this.app.get('/bundle/:file', this.getFileCallback());
        this.app.get('/test/bundle/:file', this.getTestFileCallback());

        this.app.use((error, req, res, next) => {
            this.emit('request error', res.locals.track, req.method, req.path, error);
            next(error);
        });

        this.app.use(this.statusErrors());
    }


    router () {
        return this.app;
    }


    postFeedPersistCallback () {
        return (req, res, next) => {
            let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/feed/`;
            const fileWriteStream = this.sink.writer('json');
            fileWriteStream.on('file saved', (id, file) => {
                uri += file;
                res.locals.response = {
                    file,
                    uri,
                    id,
                };
                next();
            });

            fileWriteStream.on('file not saved', (error) => {
                next(boom.wrap(error, 400, 'File not saved'));
            });

            fileWriteStream.on('error', (error) => {
                next(boom.wrap(error, 400));
            });

            req.pipe(fileWriteStream);
        };
    }


    postFeedResponseCallback () {
        return (req, res) => {
            res.status(200).json(res.locals.response);
            this.emit('request success', res.locals.track, req.method, req.path, res.locals.response.file);
        };
    }


    postBundleParseCallback () {
        return (req, res, next) => {
            body(req, res, {}, (error, bodyObj) => {
                if (error) {
                    return next(boom.wrap(error, 400, 'Failed parsing postBundle POST-body'));
                }
                res.locals.bundle = bodyObj;
                next();
            });
        };
    }


    postBundleValidateCallback () {
        return (req, res, next) => {
            schemas.ids.validate(res.locals.bundle, (error, value) => {
                if (error) {
                    return next(boom.wrap(error, 400, 'Invalid POST-body'));
                }
                res.locals.bundle = value;
                next();
            });
        };
    }


    postBundlePersistCallback () {
        return (req, res, next) => {
            let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/bundle/`;

            res.locals.bundle.forEach((file, index, arr) => {
                arr[index] = this.sink.reader(file);
                // TODO: Error listener on each reader!!
            });

            const fileWriteStream = this.sink.writer('js');

            fileWriteStream.on('file saved', (id, file) => {
                uri += file;
                res.locals.response = {
                    file,
                    uri,
                    id,
                };
                next();
            });

            fileWriteStream.on('file not saved', () => {
                next(boom.badRequest('file not saved'));
            });

            fileWriteStream.on('error', (error) => {
                next(boom.wrap(error, 400));
            });

            const reader = new Reader(res.locals.bundle);
            reader.pipe(fileWriteStream);
        };
    }


    postBundleResponseCallback () {
        return (req, res) => {
            res.status(200).json(res.locals.response);
            this.emit('request success', res.locals.track, req.method, req.path, res.locals.response.file);
        };
    }


    getFileCallback () {
        return (req, res, next) => {
            const fileReadStream = this.sink.reader(req.params.file);
            fileReadStream.on('file not found', () => {
                next(boom.notFound());
            });
            fileReadStream.on('file found', () => {
                res.status(200);
                fileReadStream.pipe(res);
                this.emit('request success', res.locals.track, req.method, req.path, req.params.file);
            });
        };
    }


    getTestFileCallback () {
        return (req, res) => {
            const uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/bundle/${req.params.file}`;
            const html = `<!doctype html>
                          <html>
                          <head><script type="text/javascript" src="${uri}"></script></head>
                          <body><p>Please open developer console</p></body>
                          </html>`;
            res.status(200).send(html);
        };
    }


    statusErrors () {
        return (error, req, res, next) => { // eslint-disable-line
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
        };
    }
};
