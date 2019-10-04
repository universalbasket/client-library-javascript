'use strict';

const assert = require('assert');
const clientLibrary = require('../../');

describe('client-library', function() {
    it('exports a "createClientSdk" method', function() {
        assert.equal(typeof clientLibrary.createClientSdk, 'function');
    });

    it('exports a "createEndUserSdk" method', function() {
        assert.equal(typeof clientLibrary.createEndUserSdk, 'function');
    });
});
