'use strict';

const MetaStorage = require('../lib/meta-storage');
const SinkMem = require('@asset-pipe/sink-mem');

test('constructor() - should take a sink', async () => {
    const sink = new SinkMem();
    // eslint-disable-next-line no-new
    new MetaStorage(sink);
});

test('constructor() - should require a sink', async () => {
    expect(() => {
        // eslint-disable-next-line no-new
        new MetaStorage();
    }).toThrowError('MetaStorage needs a sink');
});

test('get() - should reject if missing entry', async () => {
    expect.assertions(1);

    const sink = new SinkMem();
    const storage = new MetaStorage(sink);

    try {
        await storage.get('key');
    } catch (e) {
        expect(e).toEqual(
            new Error('No file could be located with name "/meta/key.json".')
        );
    }
});

test('get() - should error if non-valid json', async () => {
    expect.assertions(1);
    const sink = new SinkMem();
    const storage = new MetaStorage(sink);

    sink.db[storage.getKey('key')] = 'non-valid-json';

    try {
        await storage.get('key');
    } catch (e) {
        expect(e).toEqual(new Error('Failed parsing payload from key "key"'));
    }
});

test('get() - should error if no payload', async () => {
    expect.assertions(1);
    const sink = new SinkMem();
    const storage = new MetaStorage(sink);

    sink.db[storage.getKey('key')] = '';

    try {
        await storage.get('key');
    } catch (e) {
        expect(e).toEqual(
            new Error('No file could be located with name "/meta/key.json".')
        );
    }
});

test('get() - should error if no result and no sink error', async () => {
    expect.assertions(1);
    const sink = {
        async get() {
            return null;
        },
    };
    const storage = new MetaStorage(sink);

    try {
        await storage.get('key');
    } catch (e) {
        expect(e).toEqual(
            new Error(`Failed getting stored payload from key "key"`)
        );
    }
});

test('set() - set and get same value', async () => {
    const sink = new SinkMem();
    const storage = new MetaStorage(sink);

    const random = Math.random() * 1000;

    await storage.set('key', {
        random,
    });

    const result = await storage.get('key');
    expect(result.random).toBe(random);
});

test('has() - set and get same value', async () => {
    const sink = new SinkMem();
    const storage = new MetaStorage(sink);

    await storage.set('key', {});

    const result = await storage.has('key');
    expect(result).toBe(true);
});

test('all() - not error when empty', async () => {
    expect.assertions(1);
    const sink = new SinkMem();
    const storage = new MetaStorage(sink, `random-type-123`);

    expect(await storage.all()).toMatchSnapshot();
});

test('all() - return 1 file', async () => {
    const sink = new SinkMem();
    const storage = new MetaStorage(sink, 'text');

    await storage.set('key', { foo: 'bar' });

    const result = await storage.has('key');
    expect(result).toBe(true);

    const files = await storage.all();
    expect(files).toMatchSnapshot();
});

test('all() - return mulitiple files', async () => {
    const sink = new SinkMem();
    const storage = new MetaStorage(sink, 'text');

    await storage.set('key', { foo: 'bar' });
    await storage.set('key2', { foo: 'baz' });
    await storage.set('key3', { foo: 'bazoooka' });

    const files = await storage.all();
    expect(files).toMatchSnapshot();
});

test('all() - return files from given folder', async () => {
    const sink = new SinkMem();
    const storage = new MetaStorage(sink, 'text');

    await storage.set('key', { foo: 'bar' });
    await storage.set('key2', { foo: 'baz' });

    await sink.set('/meta/text/ignore-me/key2', '1');
    await sink.set('/meta/text/ignore-me/key3', '2');

    const files = await storage.all();
    expect(files).toMatchSnapshot();
});
