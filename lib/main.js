/* jshint node: true, strict: true */

"use strict";


const router = require('./router.js');



module.exports = function () {
    this.routes = router;
};
