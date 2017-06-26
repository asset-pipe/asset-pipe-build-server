'use strict';

const { test } = require('ava');

const MainRouter = require('../');
const SinkMem = require('asset-pipe-sink-mem');

test('uploading new assetFeedId should create entry', async t => {
    const memSink = new SinkMem();
    memSink.db.feedA = generateFeed(['a']);
    const router = new MainRouter(memSink);
    const { optimisticUpdater } = router;

    t.true(Object.keys(memSink.db).length === 1);
    t.true(Array.from(optimisticUpdater.feedStateStore.keys()).length === 0);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    t.true(Array.from(optimisticUpdater.feedStateStore.keys()).length === 1);
    t.deepEqual(optimisticUpdater.feedStateStore.get('source-1').ids, ['feedA']);
});


test('assetFeedId and sourceid gets persisted with changes', async t => {
    const memSink = new SinkMem();
    memSink.db.feedA = generateFeed(['a']);
    memSink.db.feedB = generateFeed(['b']);
    memSink.db.feedC = generateFeed(['c']);
    memSink.db.feedD = generateFeed(['d']);
    const router = new MainRouter(memSink);
    const { optimisticUpdater } = router;

    t.true(Array.from(optimisticUpdater.feedStateStore.entries()).length === 0);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    t.true(Array.from(optimisticUpdater.feedStateStore.entries()).length === 1);

    t.deepEqual(optimisticUpdater.feedStateStore.get('source-1').ids, ['feedA']);

    await optimisticUpdater.addFeedConfig('source-1', 'feedB');

    t.deepEqual(optimisticUpdater.feedStateStore.get('source-1').ids, ['feedB', 'feedA']);
});

test('layoutid and ids gets persisted', async t => {
    const memSink = new SinkMem();
    memSink.db.feedA = generateFeed(['a']);
    memSink.db.feedB = generateFeed(['b']);
    const router = new MainRouter(memSink);
    const { optimisticUpdater } = router;

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    optimisticUpdater.addLayoutConfig('layout-1', 'some-id', ['feedA']);

    const stored = Array.from(optimisticUpdater.layoutStore.entries());

    t.true(stored.length === 1);
    const [injectedLayout, injectedValue] = stored[0];
    t.true(injectedLayout === 'layout-1');
    t.true(injectedValue.bundles[0].bundleId === 'some-id');

    optimisticUpdater.addLayoutConfig('layout-1', 'some-id-2', ['feedA', 'feedB']);

    const stored2 = Array.from(optimisticUpdater.layoutStore.entries());

    t.true(stored2.length === 1);
    const [injectedLayout2, injectedValue2] = stored2[0];
    t.true(injectedLayout2 === 'layout-1');
    t.true(injectedValue2.bundles[1].bundleId === 'some-id-2');
    t.true(injectedValue2.bundles.length === 2);
});

test('uploading known assetFeedId should not trigger rebuild', async t => {
    const memSink = new SinkMem();
    memSink.db.feedA = generateFeed(['a']);
    memSink.db.feedB = generateFeed(['b']);

    const { optimisticUpdater } = new MainRouter(memSink);

    t.true(Object.keys(memSink.db).length === 2);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    const buildResult = await optimisticUpdater.builder({ layoutId: 'layout-1', feedIds: ['feedA'] });

    t.deepEqual(buildResult.included, ['feedA']);
    t.truthy(memSink.db[buildResult.file]);
    t.true(Object.keys(memSink.db).length === 3);

    optimisticUpdater.addLayoutConfig('layout-1', 'bundled-id-1', ['feedA']);

    const result = await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    const stored = Array.from(optimisticUpdater.layoutStore.entries());

    t.true(stored.length === 1);
    const [, injectedValue] = stored[0];
    t.true(injectedValue.bundles.length === 1);

    t.true(result.length === 0);

    optimisticUpdater.addLayoutConfig('layout-1', 'some-id-2', ['feedA']);
    const stored2 = Array.from(optimisticUpdater.layoutStore.entries());

    t.true(stored2.length === 1);
    const [, injectedValue2] = stored2[0];
    t.true(injectedValue2.bundles.length === 1);
});

function generateFeed (ids) {
    return JSON.stringify(ids.map(id => ({ id, entry: true, source: `console.log("log-message-${id}");` })));
}

test('uploading new assetFeedId should trigger rebuild of layout entry with previouts assetFeedID', async t => {
    const memSink = new SinkMem();
    memSink.db.feedA = generateFeed(['a']);
    memSink.db.feedB = generateFeed(['b']);
    memSink.db.feedC = generateFeed(['c']);
    memSink.db.feedD = generateFeed(['d']);
    const { optimisticUpdater } = new MainRouter(memSink);

    t.true(Object.keys(memSink.db).length === 4);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');
    await optimisticUpdater.addFeedConfig('source-2', 'feedB');
    await optimisticUpdater.addFeedConfig('source-3', 'feedC');

    const buildResult = await optimisticUpdater.builder({ layoutId: 'layout-1', feedIds: ['feedA'] });

    t.deepEqual(buildResult.included, ['feedA']);
    t.truthy(memSink.db[buildResult.file]);
    t.true(Object.keys(memSink.db).length === 5);

    optimisticUpdater.addLayoutConfig('layout-1', 'bundled-id-1', ['feedA', 'feedB', 'feedC']);

    const result = await optimisticUpdater.addFeedConfig('source-3', 'feedD');

    t.true(result.length === 1);

    const bundle1 = memSink.db[result[0].file].toString();

    t.deepEqual(result[0].included, ['feedA', 'feedB', 'feedD']);
    t.regex(bundle1, /log-message-a/);
    t.regex(bundle1, /log-message-b/);
    t.regex(bundle1, /log-message-d/);
});
