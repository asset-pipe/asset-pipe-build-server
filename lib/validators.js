/* jshint node: true, strict: true */

"use strict";

const Joi = require('joi');



/**
  * Validator for a "publication" String
  * Regex: http://regexper.com/#%2F%5E%5Ba-zA-Z0-9._-%5D%2B%24%2F
  */

module.exports.publication = Joi.string().regex(/^[a-zA-Z0-9._-]+$/).lowercase().trim().required();
