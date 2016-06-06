/* jshint node: true, strict: true */

"use strict";



const SinkFs    = require('./sink-fs/sink-fs.js'),
      BusBoy    = require('busboy'),
      express   = require('express'),
      params    = require('./params');



module.exports = function (sink) {
    this.routes = express.Router();
    sink = sink ? sink : new SinkFs('./public/js/');



    // Validate URL parameters

    this.routes.param('fileName', params.fileName);



    // Set up API routes

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



    this.routes.get('/feed/:fileName', (req, res, next) => {
        return sink.reader(req.params.fileName).pipe(res);
    });

};
