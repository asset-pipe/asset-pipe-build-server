'use strict';

const assert = require('assert');

module.exports = class MetaStorage {
    constructor(sink, type = '') {
        assert(sink, 'MetaStorage needs a sink');
        this.sink = sink;
        this.type = type;
    }

    getKey(key) {
        return `/meta/${this.type ? `${this.type}/` : ''}${key}.json`;
    }

    async set(fileName, fileContent) {
        assert(fileName, '"key" required');
        assert(fileContent, '"value" required');
        assert(!fileName.includes('/'), '"fileName" must not be a folder-path');
        return this.sink.set(
            this.getKey(fileName),
            JSON.stringify(fileContent)
        );
    }

    async get(fileName) {
        const result = await this.sink.get(this.getKey(fileName));
        if (result) {
            try {
                return JSON.parse(result);
            } catch (e) {
                throw new Error(
                    `Failed parsing payload from key "${fileName}"`
                );
            }
        }
        throw new Error(`Failed getting stored payload from key "${fileName}"`);
    }

    async has(fileName) {
        return this.sink.has(this.getKey(fileName));
    }

    async all() {
        try {
            const result = await this.sink.dir(`/meta/${this.type}`);
            return result.map(data => JSON.parse(data.content));
        } catch (e) {
            return [];
        }
    }
};
