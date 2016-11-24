"use strict";

const SinkFs    = require('asset-pipe-sink-fs'),
      reader    = require('asset-pipe-js-reader'),
      body      = require('body/json'),
      express   = require('express'),
      params    = require('./params');



const Router = module.exports = function (sink) {
    this.sink = sink ? sink : new SinkFs('./public/');
    
    this.router = express.Router();
    this.router.param('fileName', params.fileName);

    this.router.post('/feed', this.postFeed());
    this.router.get('/feed/:fileName', this.getFile());
    this.router.post('/bundle', this.postBundle());
    this.router.get('/bundle/:fileName', this.getFile());
};



Router.prototype.postFeed = function () {
    return (req, res, next) => {
        let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/feed/';

        const writer = this.sink.writer('json', (id, fileName) => {
            uri = uri + fileName;
            res.status(200).json({
                file: fileName,
                uri: uri,
                id: id
            });
        });

        return req.pipe(writer);
    };
};



Router.prototype.postBundle = function () {
    return (req, res, next) => {
        body(req, res, {}, (error, bodyObj) => {
            if (error) {
                return next(new Error());
            }

            let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/bundle/';

            bodyObj.forEach((fileName, index, arr) => {
                arr[index] = this.sink.reader(fileName);
            });

            const writer = this.sink.writer('js', (id, fileName) => {
                uri = uri + fileName;
                res.status(200).json({
                    file: fileName,
                    uri: uri,
                    id: id
                });
            });

            reader(bodyObj).pipe(writer);
        });
    };
};



Router.prototype.getFile = function () {
    return (req, res, next) => {
        return this.sink.reader(req.params.fileName).pipe(res);
    };
};
