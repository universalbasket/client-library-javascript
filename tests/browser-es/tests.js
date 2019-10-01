import * as clientLibrary from '../../index.js';

mocha.setup('bdd');

describe('client-library', function() {
    it('exports a "createClientSdk" method', function() {
        if (typeof clientLibrary.createClientSdk !== 'function') {
            throw new TypeError('Not a function.');
        }
    });

    it('exports a "createEndUserSdk" method', function() {
        if (typeof clientLibrary.createEndUserSdk !== 'function') {
            throw new TypeError('Not a function.');
        }
    });
});

mocha.run();
