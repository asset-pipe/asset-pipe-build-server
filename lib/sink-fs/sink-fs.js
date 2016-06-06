"use strict";

const fs = require('fs');



const SinkFs = module.exports = function (fileRoot) {
    this.fileRoot = fileRoot;
};



SinkFs.prototype.writer = function (fileName, callback) {
    let to = this.fileRoot + fileName;
    let stream = fs.createWriteStream(to);
    
    stream.on('close', () => {
        if (callback) {
            callback();
        }
    });

    return stream;
};



SinkFs.prototype.reader = function (fileName, callback) {
    let from = this.fileRoot + fileName;
    let stream = fs.createReadStream(from);
    
    stream.on('close', () => {
        if (callback) {
            callback();
        }
    });

    return stream;
};
