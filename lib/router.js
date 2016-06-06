'use strict';

const path        = require('path'),
      body        = require('body/json'),
      Busboy      = require('busboy'),
      express     = require('express'),
      serveStatic = require('serve-static'),
      config      = require('../config/config'),
      params      = require('./params'),
      workerFarm  = require('worker-farm'),
      workers     = workerFarm(require.resolve('./worker-uglify.js'));

const router      = express.Router();



// Validate URL parameters

router.param('publication', params.publication);



// Set middleware for serving static files 

router.use('/:publication', serveStatic(path.resolve(__dirname, '../' + config.get('docRoot'))));



// Set up routes
// curl -H 'Content-Type: application/json' -X POST -d '{"foo":"bar"}' http://127.0.1:9646/api/asset-pipe-build-server/v1/www.ba.no/js
// curl -H 'Content-Type: application/json' -X POST -d '["http://127.0.0.1:7000/js", "http://127.0.0.1:7001/js", "http://127.0.0.1:7002/js", "http://127.0.0.1:7003/js", "http://127.0.0.1:7004/js"]' http://127.0.0.1:7100/api/asset-pipe-build-server/v1/www.ba.no/js?minify=true

// curl -H 'Content-Type: application/json' -X POST -d '["http://127.0.0.1:7000/pub/assets.json", "http://127.0.0.1:7001/pub/assets.json", "http://127.0.0.1:7002/pub/assets.json", "http://127.0.0.1:7003/pub/assets.json", "http://127.0.0.1:7004/pub/assets.json"]' http://127.0.0.1:7100/api/asset-pipe-build-server/v1/www.ba.no/js

// node ../../asset-pipe-cli/lib/cli.js write -s "./assets/js/main.js" -d "./public/assets.json"

// curlype:multipart/form-data" -F "assets.json=@assets.json;type=application/json" http://127.0.0.1:7100/api/asset-pipe-build-server/v1/www.ba.no/foo


router.post('/:publication/js', (req, res, next) => {
    body(req, res, {}, (error, bodyObj) => {
        if (error) {
            // return next(errors.error(error));
            console.log(error);
        }

        workers({
          uris : bodyObj,
          minify : req.query.minify
        }, (err, file) => {
          res.status(200).json({file : 'http://127.0.0.1:7100/api/asset-pipe-build-server/v1/www.ba.no/js/' + file});
        });
    });
});

var inspect = require('util').inspect;
var os = require('os'),
    fs = require('fs');

router.post('/:publication/foo', (req, res, next) => {

    var busboy = new Busboy({ headers: req.headers });
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      console.log(fieldname, file, filename, encoding, mimetype);
      var saveTo = path.join(os.tmpDir(), path.basename(fieldname));
      console.log('me', saveTo);
      file.pipe(fs.createWriteStream(saveTo));
    });
    busboy.on('finish', function() {
      res.writeHead(200, { 'Connection': 'close' });
      res.end("That's all folks!");
    });
    return req.pipe(busboy);


/*
    var busboy = new Busboy({ headers: req.headers });

    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
      file.on('data', function(data) {
        console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
      });
      file.on('end', function() {
        console.log('File [' + fieldname + '] Finished');
      });
    });
    busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
      console.log('Field [' + fieldname + ']: value: ' + inspect(val));
    });
    busboy.on('finish', function() {
      console.log('Done parsing form!');
      // res.writeHead(303, { Connection: 'close', Location: '/' });
      // res.end();
      res.status(200).json({file : 'http://127.0.0.1:7100/api/asset-pipe-build-server/v1/www.ba.no/js/foo'});
    });
    req.pipe(busboy);
*/
});


// Export application

module.exports = router;
