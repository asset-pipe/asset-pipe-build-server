'use strict';

const SinkFs = require('asset-pipe-sink-fs');
const reader = require('asset-pipe-js-reader');
const body = require('body/json');
const express = require('express');
const { validationError: ValidationError } = require('error-obj');

const params = require('./params');
const schemas = require('./schemas');


module.exports = class Router {
    constructor ({ sink, publicPath = './public/' } = {}) {
        this.sink = sink ? sink : new SinkFs(publicPath);

        this.router = express.Router(); // eslint-disable-line
        this.router.param('fileName', params.fileName);

        this.router.post('/feed', this.postFeed());
        this.router.get('/feed/:fileName', this.getFile());
        this.router.post('/bundle', this.postBundle());
        this.router.get('/bundle/:fileName', this.getFile());
    }

    postFeed () {
        return (req, res) => {
            let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/feed/`;

            const writer = this.sink.writer('json', (id, fileName) => {
                uri += fileName;
                res.status(200).json({
                    file: fileName,
                    uri,
                    id,
                });
            });

            return req.pipe(writer);
        };
    }

    postBundle () {
        return (req, res, next) => {
            body(req, res, {}, (error, bodyObj) => {
                if (error) {
                    return next(new Error('Failed parsing postBundle POST-body'));
                }

                schemas.ids.validate(bodyObj, (validationError, value) => {
                    if (validationError) {
                        return next(new ValidationError(validationError));
                    }

                    let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/bundle/`;

                    value.forEach((fileName, index, arr) => {
                        arr[index] = this.sink.reader(fileName);
                    });

                    const writer = this.sink.writer('js', (id, fileName) => {
                        uri += fileName;
                        res.status(200).json({
                            file: fileName,
                            uri,
                            id,
                        });
                    });

                    reader(value).pipe(writer);
                });
            });
        };
    }

    getFile () {
        return (req, res) => this.sink.reader(req.params.fileName).pipe(res);
    }
};
