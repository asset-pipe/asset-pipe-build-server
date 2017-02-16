'use strict';

const { validationError: ValidationError } = require('error-obj');

const schemas = require('./schemas');

/**
  * Validate the "fileName" parameter
  *
  * @param {Object} req HTTP request object
  * @param {Object} res HTTP response object
  * @param {function} next Next function in the route
  * @param {String} param Parameter from the URL
  */
module.exports.fileName = (req, res, next, param) => {
    schemas.fileName.validate(param, (error, value) => {
        if (error) {
            return next(new ValidationError(error));
        }

        req.params.fileName = value;
        next();
    });
};
