/* jshint node: true, strict: true */

"use strict";

const SinkFs    = require('./sink-fs/sink-fs.js'),
      reader    = require('../../asset-pipe-js-reader'),
      BusBoy    = require('busboy'),
      body      = require('body/json'),
      express   = require('express'),
      params    = require('./params');



module.exports = function (sink) {
    this.routes = express.Router();
    sink = sink ? sink : new SinkFs('./public/');



    // Validate URL parameters

    this.routes.param('fileName', params.fileName);



    // Persist an asset feed

    this.routes.post('/feed', (req, res, next) => {

        let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/feed/';
        let busboy = new BusBoy({ 
            headers: req.headers 
        });

        let writer = sink.writer('json', (fileName) => {
            uri = uri + fileName;
            res.status(200).json({uri: uri});
        });

        busboy.on('file', (fieldName, file, fileName, encoding, mimeType) => {
            file.pipe(writer);
        });

        return req.pipe(busboy);
    });



    // Retrieve an asset feed

    this.routes.get('/feed/:fileName', (req, res, next) => {
        return sink.reader(req.params.fileName).pipe(res);
    });



    // Produce an asset bundle

    this.routes.post('/bundle', (req, res, next) => {
        body(req, res, {}, (error, bodyObj) => {
            if (error) {
                // return next(errors.error(error));
                console.log(error);
            }

            let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/bundle/';

            bodyObj.forEach((url, index, arr) => {
                arr[index] = sink.reader(url);
            });

            let writer = sink.writer('js', (fileName) => {
                uri = uri + fileName;
                res.status(200).json({uri: uri});
            });

            reader(bodyObj).pipe(writer);
        });
    });



    // Retrieve an asset bundle

    this.routes.get('/bundle/:fileName', (req, res, next) => {
        return sink.reader(req.params.fileName).pipe(res);
    });

};
