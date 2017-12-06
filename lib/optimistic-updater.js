'use strict';

const assert = require('assert');
const MetaStorage = require('./meta-storage');

module.exports = class OptimisticUpdater {
    constructor({ builder, sink }) {
        assert(sink, '"sink" required');
        assert(typeof builder === 'function', '"builder" required');
        this.feedStateStore = new MetaStorage(sink, 'feed');
        this.layoutStore = new MetaStorage(sink, 'layout');
        this.builder = builder;
    }

    static isEqualArray(a1, a2) {
        if (!Array.isArray(a1) || !Array.isArray(a2)) {
            throw new TypeError('isEqualArray only supports arrays');
        }
        return JSON.stringify(a1) === JSON.stringify(a2);
    }

    static hasFeedIds(layout, newFeedIds) {
        if (!layout.bundles[0]) {
            return false;
        }
        return layout.bundles.some(bundle =>
            OptimisticUpdater.isEqualArray(bundle.feedIds, newFeedIds)
        );
    }

    async addLayoutConfig(layoutId, bundleId, feedIds) {
        const layoutExists = await this.layoutStore.has(layoutId);

        if (layoutExists) {
            const layout = await this.layoutStore.get(layoutId);
            if (!OptimisticUpdater.hasFeedIds(layout, feedIds)) {
                layout.bundles.push({
                    feedIds,
                    bundleId,
                });
                await this.layoutStore.set(layoutId, layout);
            }
        } else {
            await this.layoutStore.set(layoutId, {
                bundles: [
                    {
                        feedIds,
                        bundleId,
                    },
                ],
            });
        }
    }

    async addFeedConfig(sourceId, feedId) {
        if (!sourceId) {
            return Promise.reject(new Error('Missing sourceId'));
        }

        if (!await this.feedStateStore.has(sourceId)) {
            await this.feedStateStore.set(sourceId, {
                ids: [feedId],
            });
            return Promise.resolve([]);
        }

        const source = await this.feedStateStore.get(sourceId);
        const prevFeedId = source.ids[0];
        if (prevFeedId === feedId) {
            return Promise.resolve([]);
        }

        await this.feedStateStore.set(sourceId, {
            ids: [feedId].concat(source.ids),
        });

        return this.triggerRebuilds(prevFeedId, feedId);
    }

    async triggerRebuilds(prevFeedId, nextFeedId) {
        const newBundles = await this.getNewBundles(prevFeedId, nextFeedId);
        return Promise.all(
            newBundles.map(({ layoutId, feedIds }) =>
                this.builder({ layoutId, feedIds }).then(result => {
                    this.addLayoutConfig(layoutId, result.id, feedIds);
                    return result;
                })
            )
        );
    }

    async getNewBundles(prevFeedId, nextFeedId) {
        // TODO not working...
        const entries = await this.layoutStore.all();

        console.log({ entries });

        return entries
            .map(([layoutId, layout]) =>
                layout.bundles
                    .filter(({ feedIds }) => feedIds.includes(prevFeedId))
                    .map(({ bundleId, feedIds }) => ({
                        bundleId,
                        feedIds: feedIds.map(
                            v => (v === prevFeedId ? nextFeedId : v)
                        ),
                        layoutId,
                    }))
            )
            .reduce((acc, entry) => acc.concat(entry), []);
    }
};
