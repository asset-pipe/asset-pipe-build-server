'use strict';

const validators = require('./validators.js'),
      errors     = require('error-obj'),
      log        = require('../bin/log.js');



/** 
  * Validate the "publication" parameter
  *
  * @param {Object} req HTTP request object
  * @param {Object} res HTTP response object
  * @param {function} next Next function in the route
  * @param {String} param Parameter from the URL
  */

module.exports.publication = (req, res, next, param) => {
    validators.publication.validate(param, (error, value) => {
        if (error) {
            log.error('request has illegal value for parameter "publication" - ' + param + '. Should be of type www.domain.no');
            return next(new errors.validationError(error));
        }

        req.params.publication = value;
        next();
    });
};
