/* jshint node: true, strict: true */

"use strict";

const Joi = require('joi');



/**
  * Validator for a "fileName" String
  * Regex: https://regexper.com/#%5E%5Ba-zA-Z0-9._-%5D%2B%5C.(json)%24
  */

module.exports.fileName = Joi.string().regex(/^[a-zA-Z0-9._-]+\.(json)$/).lowercase().trim().required();
