'use strict';

const OptimisticUpdater = require('../lib/optimistic-updater');
const SinkMem = require('@asset-pipe/sink-mem');

test('uploading new assetFeedId should create entry', async () => {
    const sink = new SinkMem();
    sink.db.feedA = generateFeed(['a']);
    const builder = jest.fn();
    const optimisticUpdater = new OptimisticUpdater({ sink, builder });

    expect(Object.keys(sink.db).length === 1);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    const all = await optimisticUpdater.feedStateStore.all();
    expect(all).toHaveLength(1);
    const stored = await optimisticUpdater.feedStateStore.get('source-1');
    expect(stored.ids).toEqual(['feedA']);
});

test('assetFeedId and sourceid gets persisted with changes', async () => {
    const sink = new SinkMem();
    sink.db.feedA = generateFeed(['a']);
    sink.db.feedB = generateFeed(['b']);
    sink.db.feedC = generateFeed(['c']);
    sink.db.feedD = generateFeed(['d']);
    const builder = jest.fn();
    const optimisticUpdater = new OptimisticUpdater({ sink, builder });

    const result = await optimisticUpdater.feedStateStore.all();
    expect(result).toHaveLength(0);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    const result2 = await optimisticUpdater.feedStateStore.all();
    expect(result2).toHaveLength(1);

    const stored = await optimisticUpdater.feedStateStore.get('source-1');
    expect(stored.ids).toEqual(['feedA']);

    await optimisticUpdater.addFeedConfig('source-1', 'feedB');

    const stored2 = await optimisticUpdater.feedStateStore.get('source-1');
    expect(stored2.ids).toEqual(['feedB', 'feedA']);
});

test('layoutid and ids gets persisted', async () => {
    const sink = new SinkMem();
    sink.db.feedA = generateFeed(['a']);
    sink.db.feedB = generateFeed(['b']);
    const builder = jest.fn();
    const optimisticUpdater = new OptimisticUpdater({ sink, builder });

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');
    await optimisticUpdater.addLayoutConfig('layout-1', 'some-id', ['feedA']);

    const stored = await optimisticUpdater.layoutStore.all();

    expect(stored).toHaveLength(1);
    expect(stored[0].bundles[0].bundleId === 'some-id');

    await optimisticUpdater.addLayoutConfig('layout-1', 'some-id-2', [
        'feedA',
        'feedB',
    ]);

    const stored2 = await optimisticUpdater.layoutStore.all();
    expect(stored2).toHaveLength(1);
    expect(stored2[0].bundles[1].bundleId === 'some-id-2');
    expect(stored2[0].bundles.length === 2);
});

test.skip('uploading known assetFeedId should not trigger rebuild', async () => {
    const sink = new SinkMem();
    sink.db.feedA = generateFeed(['a']);
    sink.db.feedB = generateFeed(['b']);

    const builder = jest.fn();
    const optimisticUpdater = new OptimisticUpdater({ sink, builder });

    expect(Object.keys(sink.db).length === 2);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    const buildResult = await optimisticUpdater.builder({
        layoutId: 'layout-1',
        feedIds: ['feedA'],
    });

    expect(buildResult.included).toEqual(['feedA']);

    expect(sink.db[buildResult.file]).toBeTruthy();

    expect(Object.keys(sink.db).length === 3);

    optimisticUpdater.addLayoutConfig('layout-1', 'bundled-id-1', ['feedA']);

    const result = await optimisticUpdater.addFeedConfig('source-1', 'feedA');

    const stored = Array.from(optimisticUpdater.layoutStore.all());

    expect(stored.length === 1);
    const [, injectedValue] = stored[0];
    expect(injectedValue.bundles.length === 1);

    expect(result.length === 0);

    optimisticUpdater.addLayoutConfig('layout-1', 'some-id-2', ['feedA']);
    const stored2 = Array.from(optimisticUpdater.layoutStore.all());

    expect(stored2.length === 1);
    const [, injectedValue2] = stored2[0];
    expect(injectedValue2.bundles.length === 1);
});

function generateFeed(ids) {
    return JSON.stringify(
        ids.map(id => ({
            id,
            entry: true,
            source: `console.log("log-message-${id}");`,
        }))
    );
}

test('uploading new assetFeedId should trigger rebuild of layout entry with previouts assetFeedID', async () => {
    const sink = new SinkMem();
    sink.db.feedA = generateFeed(['a']);
    sink.db.feedB = generateFeed(['b']);
    sink.db.feedC = generateFeed(['c']);
    sink.db.feedD = generateFeed(['d']);
    const builder = jest.fn();
    const optimisticUpdater = new OptimisticUpdater({ sink, builder });

    expect(Object.keys(sink.db).length === 4);

    await optimisticUpdater.addFeedConfig('source-1', 'feedA');
    await optimisticUpdater.addFeedConfig('source-2', 'feedB');
    await optimisticUpdater.addFeedConfig('source-3', 'feedC');

    const buildResult = await optimisticUpdater.builder({
        layoutId: 'layout-1',
        feedIds: ['feedA'],
    });

    expect(buildResult.included).toEqual(['feedA']);
    expect(sink.db[buildResult.file]).toBeTruthy();
    expect(Object.keys(sink.db).length === 5);

    optimisticUpdater.addLayoutConfig('layout-1', 'bundled-id-1', [
        'feedA',
        'feedB',
        'feedC',
    ]);

    const result = await optimisticUpdater.addFeedConfig('source-3', 'feedD');

    expect(result.length === 1);

    const bundle1 = sink.db[result[0].file].toString();

    expect(result[0].included).toEqual(['feedA', 'feedB', 'feedD']);
    expect(bundle1).toMatch(/log-message-a/);
    expect(bundle1).toMatch(/log-message-b/);
    expect(bundle1).toMatch(/log-message-d/);
});
