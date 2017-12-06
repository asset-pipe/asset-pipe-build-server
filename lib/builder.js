'use strict';

const buildUri = require('./uri');

const JsReader = require('asset-pipe-js-reader');
const CssReader = require('asset-pipe-css-reader');
const boom = require('boom');

module.exports = function builder({ handleAs, payload, host, secure }) {
    return new Promise((resolve, reject) => {
        let uri = buildUri({ type: 'bundle', host, secure });

        const fileStreams = payload.map(file => this.sink.reader(file));

        let fileWriteStream;
        let reader;
        if (handleAs === 'css') {
            fileWriteStream = this.sink.writer('css');
            reader = new CssReader(fileStreams);
        } else {
            fileWriteStream = this.sink.writer('js');
            reader = new JsReader(fileStreams);
        }

        fileWriteStream.on('file saved', (id, file) => {
            uri += file;
            res.locals.response = { file, uri };
            next();
        });

        fileWriteStream.on(
            'file not saved',
            this.onError(next, 'Generated file could not be saved')
        );

        fileWriteStream.on('error', this.onError(reject));

        reader.on('error', this.onError(reject));

        reader.on('file not found', () => reject(boom.notFound()));

        reader.on('pipeline empty', () =>
            reject(
                boom.badRequest(
                    'Could not load 1 or more of the resources in the payload from storage'
                )
            )
        );

        reader.on('pipeline ready', () => {
            reader.pipe(fileWriteStream);
        });
    });
};
