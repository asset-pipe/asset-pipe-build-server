"use strict";

const crypto = require('crypto'),
      path = require('path'),
      fs = require('fs');



const SinkFs = module.exports = function (fileDir) {
    this.fileDir = fileDir;
};



SinkFs.prototype.randomName = function (fileType) {
    let rand = Math.floor(Math.random() * 1000).toString();
    return 'tmp-' + Date.now().toString() + '-' + rand + '.' + fileType;
}



SinkFs.prototype.writer = function (fileType, callback) {
    let temp = path.join(this.fileDir, this.randomName(fileType));
    let hash = crypto.createHash('sha1');
    let file = fs.createWriteStream(temp);

    file.on('data', (chunk) => {
        hash.update(chunk);
    });

    file.on('finish', () => {
        let hashName = hash.digest('hex');
        fs.rename(temp, path.join(this.fileDir, hashName + '.' + fileType), () => {
            if (callback) {
                callback(hashName + '.' + fileType);
            }
        });
    });

    return file;
};



SinkFs.prototype.reader = function (fileName, callback) {
    let from = this.fileDir + fileName;
    let file = fs.createReadStream(from);
    
    file.on('finish', () => {
        if (callback) {
            callback();
        }
    });

    return file;
};
