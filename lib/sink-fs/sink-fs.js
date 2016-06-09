"use strict";

const stream = require('readable-stream'),
      crypto = require('crypto'),
      assert = require('assert'),
      path   = require('path'),
      fs     = require('fs');



const SinkFs = module.exports = function (fileDir) {
    if (!(this instanceof SinkFs)) return new SinkFs(fileDir);
    assert(fileDir, '"fileDir" must be provided');

    this.fileDir = fileDir;
};



SinkFs.prototype.tempName = function (fileType) {
    let rand = Math.floor(Math.random() * 1000).toString();
    return 'tmp-' + Date.now().toString() + '-' + rand + '.' + fileType;
}



SinkFs.prototype.writer = function (fileType, callback) {
    let temp = path.join(this.fileDir, this.tempName(fileType));
    let hash = crypto.createHash('sha1');
    
    let file = fs.createWriteStream(temp);
    file.on('finish', () => {
        let hashName = hash.digest('hex');
        fs.rename(temp, path.join(this.fileDir, hashName + '.' + fileType), () => {
            if (callback) {
                callback(hashName + '.' + fileType);
            }
        });
    });

    file.on('error', (error) => {
        console.log(error);
    });

    let hasher = new stream.Transform({
        transform: function (chunk, encoding, next) {
            hash.update(chunk, 'utf8');
            this.push(chunk);
            next();
        }
    });

    hasher.pipe(file);
    return hasher;
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
