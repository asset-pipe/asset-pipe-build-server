"use strict";

const SinkFs    = require('./sink-fs/sink-fs.js'),
      reader    = require('../../asset-pipe-js-reader'),
      BusBoy    = require('busboy'),
      body      = require('body/json'),
      express   = require('express'),
      params    = require('./params');



const Router = module.exports = function (sink) {
    this.sink = sink ? sink : new SinkFs('./public/');
    
    const router = express.Router();
    router.param('fileName', params.fileName);

    router.post('/feed', this.postFeed());
    router.get('/feed/:fileName', this.getFile());
    router.post('/bundle', this.postBundle());
    router.get('/bundle/:fileName', this.getFile());

    return router;
};



Router.prototype.postFeed = function () {
    return (req, res, next) => {
        let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/feed/';
        let busboy = new BusBoy({ 
            headers: req.headers 
        });

        let writer = this.sink.writer('json', (fileName) => {
            uri = uri + fileName;
            res.status(200).json({uri: uri});
        });

        busboy.on('file', (fieldName, file, fileName, encoding, mimeType) => {
            file.pipe(writer);
        });

        return req.pipe(busboy);
    };
};



Router.prototype.postBundle = function () {
    return (req, res, next) => {
        body(req, res, {}, (error, bodyObj) => {
            if (error) {
                // return next(errors.error(error));
                console.log(error);
            }

            let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/bundle/';

            bodyObj.forEach((fileName, index, arr) => {
                arr[index] = this.sink.reader(fileName);
            });

            let writer = this.sink.writer('js', (fileName) => {
                uri = uri + fileName;
                res.status(200).json({uri: uri});
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
