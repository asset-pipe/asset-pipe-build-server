'use strict';

module.exports = function buildUri({ type, host, secure }) {
    return `http${secure ? 's' : ''}://${host}/${type}/`;
};
