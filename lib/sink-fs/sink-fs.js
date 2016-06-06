"use strict";

const fs = require('fs');



const SinkFs = module.exports = function () {

};



SinkFs.prototype.writer = function (hash, code, callback) {
    return fs.writeFile('./public/js/' + hash + '.js', code, (err) => {
        callback(null, name + '.js');
    });
};



SinkFs.prototype.reader = function (hash, callback) {
    /*
    return fs.writeFile('./public/js/' + hash + '.js', code, (err) => {
        callback(null, name + '.js');
    });
    */
};