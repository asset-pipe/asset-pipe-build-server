'use strict';

const validators = require('./validators.js'),
      errors     = require('error-obj');



/** 
  * Validate the "fileName" parameter
  *
  * @param {Object} req HTTP request object
  * @param {Object} res HTTP response object
  * @param {function} next Next function in the route
  * @param {String} param Parameter from the URL
  */

module.exports.fileName = (req, res, next, param) => {
    validators.fileName.validate(param, (error, value) => {
        if (error) {
            return next(new errors.validationError(error));
        }

        req.params.fileName = value;
        next();
    });
};
