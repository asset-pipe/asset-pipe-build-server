'use strict';

const path        = require('path'),
      body        = require('body/json'),
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



// Export application

module.exports = router;
