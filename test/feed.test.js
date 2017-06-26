'use strict';

const { test } = require('ava');

const MainRouter = require('../');
const SinkMem = require('asset-pipe-sink-mem');
const { createReadStream, readFileSync } = require('fs');
const express = require('express');
const superTest = require('supertest');

test('postFeedUpload should work', async t => {
    const memSink = new SinkMem();
    const router = new MainRouter(memSink);

    t.true(Object.keys(memSink.db).length === 0);

    const request = createReadStream(`${__dirname}/fixtures/feed.json`);
    const result = await router.postFeedUpload('source-1', request);

    t.truthy(result.file);
    t.truthy(result.id);
    t.true(Object.keys(memSink.db).length === 1);
});

test('POST /feed should persist file', async t => {
    const memSink = new SinkMem();
    const router = new MainRouter(memSink);
    const app = express();
    app.use(router.router());

    t.true(Object.keys(memSink.db).length === 0);
    const feed = readFileSync(`${__dirname}/fixtures/feed.json`, 'utf8');
    const result = await superTest(app)
        .post('/feed/source-id-1')
        .send(feed)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .expect(200);

    const { file, id, uri } = result.body;
    t.truthy(file);
    t.truthy(id);
    t.truthy(uri);

    t.true(Object.keys(memSink.db).length === 1);
    t.true(memSink.db[file].toString() === feed);
});
