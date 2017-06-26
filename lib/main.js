'use strict';

const EventEmitter = require('events');
const express = require('express');
const SinkMem = require('asset-pipe-sink-mem');
const Reader = require('asset-pipe-js-reader');
const body = require('body/json');
const boom = require('boom');
const uuid = require('uuid/v4');

const params = require('./params');
const schemas = require('./schemas');

/*

    "POST /feed (array of modules with content)
        => current feed upload in progress? wait for event on done.
        -> new assetFeedId
        -> lookup and find last assetFeedId
        -> trigger builds on previous assetFeedId layout
        ? - option: wait for optimistic bundling to be "done"

    Per layoutserver
        map:
            bundle-id -> [assetFeedId, assetFeedId, assetFeedId]
            bundle-id -> [assetFeedId, assetFeedId, assetFeedId]
        map:
            podlet-id: [assetFeedId, assetFeedId, assetFeedId]


        assetFeedId: {
            podletId: global-search,
            layouts: ['id', 'id']
        }

    Queue
        - Feed
            - Events when optimisitic bundling done
        - Layoutserver request / bundling
            - Events when done


    TODO:

        mutex-strategi?
            creator-hash

        enQueue(options).then()

        * queue for feed processsing
            * method for checking if feed already inside queue
        * queue for bundle processing
            * method for checking if bundle already inside queue


*/

class Queue {
    constructor () {
        this.queue = new Map();
    }

    addFeed (sourceId, feedId) {

    }

    // on feed-done, bundle-done


    addBundleRequest (idsList) {

    }
}

// feed
// (podletA-1 & podletA-2) => feedA
// /feed << persist (put on queue)
// (persist once) (`addFeedConfig`)
// After persist, spread state across asset servers
// Trigger rebuild if known podlet (`triggerRebuilds`)
// (persist once)
    // After rebuild, spread state
// Answer ok to podlet1 & podlet2

// bundle
// (layoutA-1 & layoutA-2) || feedA as part of layoutA has changed => [feedA, feedB]
// check if [feedA, feedB] exists (distributed), return existent hash
// check if layoutA exists => rebuild layoutA with new feeds (`addLayoutConfig`)
// (persist once)
    // After rebuild, spread state
// build layoutA (`this.builder`)
// (persist once)
    // After rebuild, spread state
// answer OK to layoutA || feedA

class OptimisticUpdater {
    constructor ({ builder }) {
        this.feedStateStore = new Map();
        this.layoutStore = new Map();
        this.builder = builder;
    }


    static isEqualArray (a1, a2) {
        if (!Array.isArray(a1) || !Array.isArray(a2)) {
            throw new TypeError('isEqualArray only supports arrays');
        }
        return JSON.stringify(a1) === JSON.stringify(a2);
    }

    static hasFeedIds (layout, newFeedIds) {
        if (!layout.bundles[0]) {
            return false;
        }
        return layout.bundles.some(bundle => OptimisticUpdater.isEqualArray(bundle.feedIds, newFeedIds));
    }

    addLayoutConfig (layoutId, bundleId, feedIds) {
        let layout = this.layoutStore.get(layoutId);
        if (!layout) {
            layout = {
                bundles: [],
            };
        }

        if (!OptimisticUpdater.hasFeedIds(layout, feedIds)) {
            layout.bundles.push({
                feedIds,
                bundleId,
            });
            this.layoutStore.set(layoutId, layout);
        }
    }

    addFeedConfig (sourceId, feedId) {
        if (!sourceId) {
            return Promise.reject(new Error('Missing sourceId'));
        }

        const source = this.feedStateStore.get(sourceId);
        if (!source) {
            this.feedStateStore.set(sourceId, {
                ids: [feedId],
            });
            return Promise.resolve([]);
        }

        const prevFeedId = source.ids[0];
        if (prevFeedId === feedId) {
            return Promise.resolve([]);
        }

        this.feedStateStore.set(sourceId, {
            ids: [feedId].concat(source.ids),
        });

        return this.triggerRebuilds(prevFeedId, feedId);
    }

    triggerRebuilds (prevFeedId, nextFeedId) {
        const newBundles = this.getNewBundles(prevFeedId, nextFeedId);
        return Promise.all(
            newBundles.map(({ layoutId, feedIds }) =>
                this.builder({ layoutId, feedIds })
                    .then(result => {
                        this.addLayoutConfig(layoutId, result.id, feedIds);
                        return result;
                    }))
        );
    }

    getNewBundles (prevFeedId, nextFeedId) {
        return Array.from(this.layoutStore.entries())
            .map(([layoutId, layout]) =>
                layout.bundles
                    .filter(({ feedIds }) => feedIds.includes(prevFeedId))
                    .map(({ bundleId, feedIds }) => ({
                        bundleId,
                        feedIds: feedIds.map(v => (v === prevFeedId ? nextFeedId : v)),
                        layoutId,
                    }))
            )
            .reduce((acc, entry) => acc.concat(entry), []);
    }
}


module.exports = class Router extends EventEmitter {
    constructor (sink) {
        super();

        this.sink = sink ? sink : new SinkMem();

        this.app = express.Router(); // eslint-disable-line

        this.app.use((req, res, next) => {
            res.locals.track = uuid();
            this.emit('request start', res.locals.track, req.method, req.path);
            next();
        });

        this.optimisticUpdater = new OptimisticUpdater({
            builder: ({ layoutId, feedIds }) => this.postBundleUpload(layoutId, feedIds),
        });

        this.app.param('file', params.file);

        this.app.post('/feed/:creator', this.postFeedPersistCallback(),
                               this.postFeedResponseCallback());

        this.app.get('/feed/:file', this.getFileCallback());

        this.app.post('/bundle/:creator', this.postBundleParseCallback(),
                                 this.postBundleValidateCallback(),
                                 this.postBundlePersistCallback(),
                                 this.postBundleResponseCallback());

        this.app.get('/bundle/:file', this.getFileCallback());
        this.app.get('/test/bundle/:file', this.getTestFileCallback());

        this.app.use((error, req, res, next) => {
            this.emit('request error', res.locals.track, req.method, req.path, res.locals.payload, error);
            next(error);
        });

        this.app.use(this.statusErrors());
    }


    router () {
        return this.app;
    }

    postFeedUpload (creator, uploadStream) {
        return new Promise((resolve, reject) => {
            const fileWriteStream = this.sink.writer('json');
            fileWriteStream.on('file saved', (id, file) => {
                this.optimisticUpdater
                    .addFeedConfig(creator, id)
                    .then(() => {
                        resolve({
                            file,
                            id,
                        });
                    })
                    .catch(reject);
            });

            fileWriteStream.on('file not saved', (error) => {
                reject(boom.wrap(error, 400, 'File not saved'));
            });

            fileWriteStream.on('error', (error) => {
                reject(boom.wrap(error, 400));
            });

            uploadStream.pipe(fileWriteStream);
        });
    }

    postFeedPersistCallback () {
        return (req, res, next) => {
            const { creator } = req.params;
            this.postFeedUpload(creator, req)
                .then(({ file, id }) => {
                    res.locals.response = {
                        file,
                        uri: `${(req.secure ? 'https://' : 'http://') + req.headers.host}/feed/${file}`,
                        id,
                    };
                    next();
                })
                .catch(next);
        };
    }

    postFeedResponseCallback () {
        return (req, res) => {
            res.status(200).json(res.locals.response);
            this.emit('request success', res.locals.track, req.method, req.path, res.locals.response.file);
        };
    }


    postBundleParseCallback () {
        return (req, res, next) => {
            body(req, res, {}, (error, bodyObj) => {
                if (error) {
                    return next(boom.wrap(error, 400, 'Failed parsing postBundle POST-body'));
                }
                res.locals.payload = bodyObj;
                next();
            });
        };
    }


    postBundleValidateCallback () {
        return (req, res, next) => {
            schemas.ids.validate(res.locals.payload, (error, payload) => {
                if (error) {
                    return next(boom.wrap(error, 400, 'Invalid POST-body'));
                }
                res.locals.payload = payload;
                next();
            });
        };
    }


    postBundleUpload (creator, files) {
        return new Promise((resolve, reject) => {
            const included = [];
            const excluded = [];

            const fileStreams = files.map((file) => this.sink.reader(file));
            const fileWriteStream = this.sink.writer('js');

            fileWriteStream.on('file saved', (id, file) => {
                this.optimisticUpdater.addLayoutConfig(creator, id, files);
                resolve({
                    included,
                    excluded,
                    file,
                    id,
                });
            });

            fileWriteStream.on('file not saved', (error) => {
                reject(boom.wrap(error, 400, 'Generated file could not be saved'));
            });

            fileWriteStream.on('error', (error) => {
                reject(boom.wrap(error, 400));
            });

            const reader = new Reader(fileStreams);

            reader.on('error', (error) => {
                reject(boom.wrap(error, 400));
            });

            reader.on('file found', (file) => {
                included.push(file);
            });

            reader.on('file not found', (file) => {
                excluded.push(file);
            });

            reader.on('pipeline empty', () => {
                reject(boom.badRequest('Could not load any of the resources in the payload from storage'));
            });

            reader.on('pipeline ready', () => {
                reader.pipe(fileWriteStream);
            });
        });
    }

    postBundlePersistCallback () {
        return (req, res, next) => {
            const uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/bundle/`;

            const { creator } = this.params;
            const { payload } = res.locals;

            this.postBundleUpload(creator, payload)
                .then(result => {
                    const { file, id, included, excluded } = result;
                    res.locals.response = { file, id, uri: `${uri}${file}` };
                    res.locals.included = included;
                    res.locals.excluded = excluded;
                    next();
                })
                .catch(e => next(e));
        };
    }


    postBundleResponseCallback () {
        return (req, res) => {
            const response = {
                payload: res.locals.payload,
                included: res.locals.included,
                excluded: res.locals.excluded,
                response: res.locals.response,
            };

            this.emit('request success', res.locals.track, req.method, req.path, res.locals.response.file);

            if (response.payload.length === response.response.length) {
                return res.status(200).json(response);
            }

            res.status(202).json(response);
        };
    }


    getFileCallback () {
        return (req, res, next) => {
            const fileReadStream = this.sink.reader(req.params.file);
            fileReadStream.on('file not found', () => {
                next(boom.notFound());
            });
            fileReadStream.on('file found', () => {
                res.status(200);
                fileReadStream.pipe(res);
                this.emit('request success', res.locals.track, req.method, req.path, req.params.file);
            });
        };
    }


    getTestFileCallback () {
        return (req, res) => {
            const uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/bundle/${req.params.file}`;
            const html = `<!doctype html>
                          <html>
                          <head><script type="text/javascript" src="${uri}"></script></head>
                          <body><p>Please open developer console</p></body>
                          </html>`;
            res.status(200).send(html);
        };
    }


    statusErrors () {
        return (error, req, res, next) => { // eslint-disable-line
            const accepts = req.xhr ? 'json' : req.accepts(['html', 'json', 'text']);
            switch (accepts) {
                case 'json':
                    res.status(error.output.payload.statusCode).json(error.output.payload);
                    break;
                case 'html':
                    res.status(error.output.payload.statusCode).send(`<html><body><h1>${error.output.payload.error}</h1></body></html>`);
                    break;
                case 'text':
                    res.status(error.output.payload.statusCode).send(error.output.payload.error);
                    break;
                default:
                    res.status(406).send('Not Acceptable');
            }
        };
    }
};
