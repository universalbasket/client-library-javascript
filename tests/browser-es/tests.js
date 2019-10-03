mocha.setup('bdd');

describe('client-library', function() {
    let mod;

    before(function() {
        return import('../../index.js')
            .then(function(result) {
                mod = result;
            });
    });

    it('exports a "createClientSdk" method', function() {
        if (typeof mod.createClientSdk !== 'function') {
            throw new TypeError('Not a function.');
        }
    });

    it('exports a "createEndUserSdk" method', function() {
        if (typeof mod.createEndUserSdk !== 'function') {
            throw new TypeError('Not a function.');
        }
    });
});

mocha.run();
