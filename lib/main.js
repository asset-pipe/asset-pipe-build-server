'use strict';

const express = require('express');
const SinkFs = require('asset-pipe-sink-fs');
const Reader = require('asset-pipe-js-reader');
const body = require('body/json');
const boom = require('boom');

const params = require('./params');
const schemas = require('./schemas');


module.exports = class Router {
    constructor (sink) {
        this.sink = sink ? sink : new SinkFs({
            path: './public'
        });

        this.app = express.Router(); // eslint-disable-line
        this.app.param('file', params.file);

        this.app.post('/feed', this.postFeedCallback());
        this.app.get('/feed/:file', this.getFileCallback());

        this.app.post('/bundle', this.postBundleParseCallback(),
                                 this.postBundleValidateCallback(),
                                 this.postBundlePersistCallback(),
                                 this.postBundleResponseCallback());
        this.app.get('/bundle/:file', this.getFileCallback());
    }


    router () {
        return this.app;
    }


    postFeedCallback () {
        return (req, res) => {
            let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/feed/`;
            const fileWriteStream = this.sink.writer('json');
            fileWriteStream.on('file saved', (id, file) => {
                uri += file;
                res.status(200).json({
                    file,
                    uri,
                    id,
                });
            });

            fileWriteStream.on('file not saved', () => {
                next(boom.badRequest('file not saved'));
            });

            fileWriteStream.on('error', (error) => {
                next(boom.badRequest('error'));
            });

            req.pipe(fileWriteStream);
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
                next(boom.badRequest('error'));
            });

            const reader = new Reader(res.locals.bundle);
            reader.pipe(fileWriteStream);
        };
    }


    postBundleResponseCallback () {
        return (req, res) => {
            res.status(200).json(res.locals.response);
        };
    }


    getFileCallback () {
        return (req, res) => this.sink.reader(req.params.file).pipe(res);
    }
};
