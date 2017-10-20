'use strict';

const express = require('express');
const SinkMem = require('asset-pipe-sink-mem');
const SinkFs = require('asset-pipe-sink-fs');
const Router = require('../lib/main');
const supertest = require('supertest');
const pretty = require('pretty');

function createTestServerFor(router) {
    const app = express();
    app.use(router);
    return new Promise(resolve => {
        const server = app.listen(() => {
            resolve({
                server,
                port: server.address().port,
            });
        });
    });
}

const singleFeed = [
    {
        id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
        source: '"use strict";module.exports.world=function(){return"world"};',
        deps: {},
        file: './assets/js/bar.js',
    },
];

describe('Router class', () => {
    test('new Router() with no arguments', () => {
        expect.assertions(1);
        const router = new Router();
        expect(router.sink).toBeInstanceOf(SinkMem);
    });

    test('new Router(sink) with sink argument', () => {
        expect.assertions(1);
        const sink = new SinkFs({ path: '/' });
        const router = new Router(sink);
        expect(router.sink).toBeInstanceOf(SinkFs);
    });

    test('new Router().router property', () => {
        expect.assertions(1);
        const router = new Router();
        expect(router.router.name).toEqual(express.Router().name); // eslint-disable-line
    });
});

describe('Router instance methods', () => {
    test('postFeedResponseCallback', done => {
        expect.assertions(5);
        const router = new Router();
        const json = jest.fn();
        const req = {
            method: 'POST',
            path: '/feed',
        };
        const res = {
            json,
            locals: { response: { file: 'foo' }, track: 'bar' },
        };
        router.on('request success', (track, method, path, file) => {
            expect(track).toBe('bar');
            expect(method).toBe('POST');
            expect(path).toBe('/feed');
            expect(file).toBe('foo');
            expect(json).toHaveBeenCalledWith({ file: 'foo' });
            done();
        });

        router.postFeedResponseCallback()(req, res);
    });

    test('getTestFileCallback: secure', () => {
        expect.assertions(1);
        const router = new Router();
        const send = jest.fn();
        const req = {
            params: { file: 'bar' },
            headers: { host: 'foo' },
            secure: true,
        };
        const res = {
            send,
        };

        router.getTestFileCallback()(req, res);
        expect(pretty(send.mock.calls[0][0])).toMatchSnapshot();
    });

    test('getTestFileCallback: insecure', () => {
        expect.assertions(1);
        const router = new Router();
        const send = jest.fn();
        const req = {
            params: { file: 'bar' },
            headers: { host: 'foo' },
            secure: false,
        };
        const res = {
            send,
        };

        router.getTestFileCallback()(req, res);
        expect(pretty(send.mock.calls[0][0])).toMatchSnapshot();
    });

    test('statusErrors: json', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            xhr: true,
        };
        const err = {
            output: {
                payload: { statusCode: 'foo' },
            },
        };
        const json = jest.fn();
        const res = {
            json,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(json).toHaveBeenCalledWith({ statusCode: 'foo' });
    });

    test('statusErrors: html', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            accepts() {
                return 'html';
            },
        };
        const err = {
            output: {
                payload: { statusCode: 'foo', error: 'foo' },
            },
        };
        const send = jest.fn();
        const res = {
            send,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(send).toHaveBeenCalledWith(
            '<html><body><h1>foo</h1></body></html>'
        );
    });

    test('statusErrors: text', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            accepts() {
                return 'text';
            },
        };
        const err = {
            output: {
                payload: { statusCode: 'foo', error: 'foo' },
            },
        };
        const send = jest.fn();
        const res = {
            send,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(send).toHaveBeenCalledWith('foo');
    });

    test('statusErrors: default', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            accepts() {
                return 'foo';
            },
        };
        const err = {
            output: {
                payload: { statusCode: 'foo', error: 'foo' },
            },
        };
        const send = jest.fn();
        const res = {
            send,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(send).toHaveBeenCalledWith('Not Acceptable');
    });

    test('onError', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();
        const error = new Error('bar');

        router.onError(next)(error);

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('onError with message', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();
        const message = 'foo';
        const error = new Error('bar');

        router.onError(next, message)(error);

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('onPipelineEmpty', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();

        router.onPipelineEmpty(next)();

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('onFileNotFound', () => {
        expect.assertions(2);
        const router = new Router();
        const res = {
            locals: { excluded: [] },
        };
        const file = 'foo';

        router.onFileNotFound(res)(file);

        expect(res.locals.excluded).toHaveLength(1);
        expect(res.locals.excluded[0]).toBe('foo');
    });

    test('onNotFound', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();

        router.onNotFound(next)();

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('buildUri: secure', () => {
        expect.assertions(1);
        const router = new Router();

        const uri = router.buildUri('bar', 'foo', true);

        expect(uri).toBe('https://foo/bar/');
    });

    test('buildUri: insecure', () => {
        expect.assertions(1);
        const router = new Router();

        const uri = router.buildUri('bar', 'foo', false);

        expect(uri).toBe('http://foo/bar/');
    });
});

describe('uploading feeds', () => {
    let router;
    let server;
    let port;

    beforeEach(async () => {
        router = new Router();
        ({ server, port } = await createTestServerFor(router.router()));
    });

    test('/feed: empty array', async () =>
        supertest(server)
            .post('/feed')
            .send([])
            .expect(400));

    test('/feed: empty string', async () =>
        supertest(server)
            .post('/feed')
            .send('')
            .expect(400));

    test('/feed', async () =>
        supertest(server)
            .post('/feed')
            .send(singleFeed)
            .expect(200)
            .then(res => {
                expect(res.body).toEqual({
                    file:
                        'f652e904f72daa8bd884df867b69861bcb90be9508a1d558f05070d5d044d0d3.json',
                    id:
                        'f652e904f72daa8bd884df867b69861bcb90be9508a1d558f05070d5d044d0d3',
                    uri: `http://127.0.0.1:${port}/feed/f652e904f72daa8bd884df867b69861bcb90be9508a1d558f05070d5d044d0d3.json`,
                });
            }));

    afterEach(() => server.close());
});

describe('downloading feeds', () => {
    let router;
    let server;
    let file;
    let get;
    let post;

    beforeEach(async () => {
        router = new Router();
        ({ server } = await createTestServerFor(router.router()));
        ({ get, post } = supertest(server));

        return post('/feed')
            .send(singleFeed)
            .expect(200)
            .then(({ body }) => {
                file = body.file;
            });
    });

    test('/feed/:file', () => {
        router.on('request success', (track, method, path, fileName) => {
            expect(typeof track).toBe('string');
            expect(method).toBe('GET');
            expect(path).toBe(`/feed/${file}`);
            expect(fileName).toBe(`${file}`);
        });
        return get(`/feed/${file}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .then(({ body }) => {
                expect(body).toEqual([
                    {
                        id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                        source:
                            '"use strict";module.exports.world=function(){return"world"};',
                        deps: {},
                        file: './assets/js/bar.js',
                    },
                ]);
            });
    });

    test('/feed/:file', () => get(`/feed/doesnotexist`).expect(400));

    afterEach(() => server.close());
});

describe('bundling assets', () => {
    let server;
    let bundles;

    beforeEach(async () => {
        const router = new Router();
        ({ server } = await createTestServerFor(router.router()));
        const post = supertest(server).post;
        return Promise.all([
            post('/feed')
                .send([
                    {
                        id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                        source:
                            '"use strict";module.exports.world=function(){return"world"};',
                        deps: {},
                        file: './assets/js/bar.js',
                    },
                ])
                .expect(200),
        ]).then(result => {
            bundles = result.map(({ body: { file } }) => file);
        });
    });

    test('/bundle', () =>
        supertest(server)
            .post('/bundle')
            .send(bundles)
            .expect(200)
            .then(({ body }) => {
                body.response.uri = body.response.uri.replace(
                    /http:\/\/[0-9.:]+/,
                    ''
                );
                expect(body).toMatchSnapshot();
            }));

    test('/bundle with body as empty array', () =>
        supertest(server)
            .post('/bundle')
            .send([])
            .expect(400));

    test('/bundle with empty body', () =>
        supertest(server)
            .post('/bundle')
            .expect(400));

    afterEach(() => server.close());
});

describe('bundling feeds', () => {
    let server;
    let get;
    let fileName;

    beforeEach(async () => {
        const router = new Router();
        let post;
        ({ server } = await createTestServerFor(router.router()));

        ({ get, post } = supertest(server)); // eslint-disable-line prefer-const
        const feed1 = [
            {
                id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                source:
                    '"use strict";module.exports.hello=function(){return"hello"};',
                deps: {},
                file: './assets/js/hello.js',
            },
        ];
        const feed2 = [
            {
                id: 'd645cf572a8f5srf8716e4846b408d3b1ca45c23',
                source:
                    '"use strict";module.exports.world=function(){return"world"};',
                deps: {},
                file: './assets/js/world.js',
            },
        ];

        const uploadFeed1 = post('/feed')
            .send(feed1)
            .expect(200);
        const uploadFeed2 = post('/feed')
            .send(feed2)
            .expect(200);

        try {
            const responses = await Promise.all([uploadFeed1, uploadFeed2]);

            ({ body: { response: { file: fileName } } } = await post('/bundle')
                .send(responses.map(({ body: { file } }) => file))
                .expect(200));
        } catch (err) {
            throw err;
        }
    });

    test('/bundle/:file', () => get(`/bundle/${fileName}`).expect(200));

    afterEach(() => server.close());
});
