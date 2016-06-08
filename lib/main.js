/* jshint node: true, strict: true */

"use strict";

const SinkFs    = require('./sink-fs/sink-fs.js'),
      reader    = require('../../asset-pipe-js-reader'),
      shasum    = require('shasum'),
      crypto    = require('crypto'),
      BusBoy    = require('busboy'),
      body      = require('body/json'),
      express   = require('express'),
      params    = require('./params');



module.exports = function (sink) {
    this.routes = express.Router();
    sink = sink ? sink : new SinkFs('./public/js/');



    // Validate URL parameters

    this.routes.param('fileName', params.fileName);



    // Persist an asset feed

    this.routes.post('/feed', (req, res, next) => {

        let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/feed/';
        let busboy = new BusBoy({ 
            headers: req.headers 
        });

        busboy.on('file', (fieldName, file, fileName, encoding, mimeType) => {
            uri += fileName;
            file.pipe(sink.writer(fileName));
        });

        busboy.on('finish', () => {
            res.status(200).json({uri : uri});
        });

        return req.pipe(busboy);
    });


    // Retrieve an asset feed

    this.routes.get('/feed/:fileName', (req, res, next) => {
        return sink.reader(req.params.fileName).pipe(res);
    });




    this.routes.post('/bundle', (req, res, next) => {
        body(req, res, {}, (error, bodyObj) => {
            if (error) {
                // return next(errors.error(error));
                console.log(error);
            }

            let uri = (req.secure ? 'https://' : 'http://') + req.headers.host + '/bundle/';
            let hash = crypto.createHash('sha1');

            bodyObj.forEach((url, index, arr) => {
                arr[index] = sink.reader(url);
            });

            let writer = sink.writer('./foooooo.js');
            writer.on('data', (data) => {
                hash.update(data);
            });
            writer.on('finish', () => {
                var fileName = hash.digest('hex');
                uri += fileName;
                res.status(200).json({uri: uri});
            });

            reader(bodyObj).pipe(writer);

/*
            workers({
              uris : bodyObj,
              minify : req.query.minify
            }, (err, file) => {
              res.status(200).json({file : 'http://127.0.0.1:7100/api/asset-pipe-build-server/v1/www.ba.no/js/' + file});
            });
*/
        });
    });

};
