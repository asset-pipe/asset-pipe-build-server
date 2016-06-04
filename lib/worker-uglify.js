'use strict';

const stream      = require('readable-stream'),
      request     = require('request'),
      UglifyJS    = require('uglify-js'),
      shasum      = require('shasum'),
      reader      = require('../../asset-pipe-js-reader'),
      fs          = require('fs');



module.exports = (source, callback) => {

    console.log('worker pid', process.pid);

    source.uris.forEach((url, index, arr) => {
        arr[index] = request.get(url);
    });

    let buffer = '';

    let dest = new stream.Writable({
      write: function(chunk, encoding, next) {
        buffer += chunk.toString();
        next()
      }
    });

    dest.on('finish', () => {
      let start = process.hrtime();
      let code = buffer;

      if (source.minify) {
        let result = UglifyJS.minify(code, {
              fromString: true, 
              compress: true
        });
        code = result.code;
      }

      let name = shasum(code);

      fs.writeFile('./public/js/' + name + '.js', code, (err) => {
            let end = process.hrtime(start);
            console.log("build time:", end[0] + 'sec', end[1]/1000000 + 'ms');
            callback(null, name + '.js');
      });
      
    });

    reader(source.uris).pipe(dest);
};
