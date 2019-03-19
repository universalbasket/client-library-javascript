function base64Encode(string) {
    if (typeof btoa === 'function') {
        return btoa(string);
    }
    if (typeof Buffer === 'function') {
        return Buffer.from(string).toString('base64');
    }
    throw new Error('No way to convert to base64');
}

var defaultApiUrl = 'https://api.automationcloud.net';
var defaultVaultUrl = 'https://vault.automationcloud.net';
var defaultFetch = self.fetch && self.fetch.bind(self);

function fetch(url, fetchApi, token, opts) {
    var options = opts || {};
    var method = options.method || 'GET';

    if (!token) {
        throw new Error('No token.');
    }

    var headers = {};

    Object.keys(options.headers || {}).forEach(function(key) {
        headers[key] = options.headers[key];
    });

    headers['Authorization'] = 'Basic ' + base64Encode(token + ':');

    var body = options.body === void 0 ? void 0 : JSON.stringify(options.body);

    if (typeof body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    var fetchOptions = {
        method: method,
        headers: headers,
        body: body,
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        referrer: 'client',
        referrerPolicy: 'origin',
        keepalive: false
    };

    return fetchApi(url, fetchOptions)
        .then(function(response) {
            if (!response.ok) {
                return response.json()
                    .then(function(body) {
                        // TODO: Better errors from error bodies.
                        throw new Error(body.message || 'Unexpected response');
                    });
            }

            if (options.parse !== false) {
                return response.json();
            }

            return response;
        });
}

function makeJobApi(apiFetch, jobId) {
    var callbacks = [];
    var trackingTimeoutRef;
    var job;

    const jobApi = {
        get: function() {
            return apiFetch(`jobs/${jobId}`);
        },
        cancel: function() {
            return apiFetch(`jobs/${jobId}/cancel`, { method: 'POST' });
        },
        reset: function() {
            return apiFetch(`jobs/${jobId}/reset`, { method: 'POST' });
        },
        createInput: function({ key, stage, data }) {
            return apiFetch(`jobs/${jobId}/inputs`, { method: 'POST', body: { jobId, key, stage, data } });
        },
        getOutputs: function({ key, stage }) {
            return apiFetch(`jobs/${jobId}${key ? `/${key}${stage ? `/${stage}` : ''}` : ''}`);
        },
        getScreenshots: function() {
            return apiFetch(`jobs/${jobId}/screenshots`);
        },
        getScreenshot: function({ id, ext }) {
            return apiFetch(`jobs/${jobId}/screenshots/${id}.${ext}`, { parse: false })
                .then(res => res.blob());
        },
        getMimoLogs: function() {
            return apiFetch(`jobs/${jobId}/mimo-logs`);
        },
        track: function(callback) {
            callbacks.add(callback);

            if (!trackingTimeoutRef) {
                poll(1000);
            }
        },
        untrack: function(callback) {
            callbacks.delete(callback);

            if (!callbacks.size) {
                clearTimeout(trackingTimeoutRef);
                trackingTimeoutRef = null;
            }
        }
    };

    // TODO: Use an events service.
    function poll(dt) {
        trackingTimeoutRef = setTimeout(function() {
            jobApi.get()
                .then(function(updated) {
                    if (!trackingTimeoutRef) {
                        return;
                    }

                    if (!job) {
                        job = updated;
                    }

                    if (updated.state !== job.state) {
                        for (const callback of callbacks) {
                            callback(updated, job);
                        }
                    }

                    job = updated;
                })
                .catch(function(error) {
                    console.error(error);
                })
                .then(function() {
                    poll(dt);
                });
        }, dt);
    }

    return jobApi;
}

export function makeEndUserApi(options) {
    if (!options || !options.token) {
        throw new Error('No token.');
    }

    var apiUrl = options.apiUrl || defaultApiUrl;
    var vaultUrl = options.vaultUrl || defaultVaultUrl;
    var fetchApi = options.fetchApi || defaultFetch;
    var token = options.token;
    var canonicalizedApiUrl = apiUrl.slice(-1) === '/' ? apiUrl : (apiUrl + '/');
    var canonicalizedVaultUrl = vaultUrl.slice(-1) === '/' ? vaultUrl : (vaultUrl + '/');

    if (!fetchApi) {
        throw new Error('No fetch found.');
    }

    function apiFetch(path, options) {
        return fetch(canonicalizedApiUrl + path, fetchApi, token, options);
    }

    function vaultFetch(path, options) {
        return fetch(canonicalizedVaultUrl + path, fetchApi, token, options);
    }

    return apiFetch('end-user')
        .then(endUser => {
            return {
                job: makeJobApi(apiFetch, endUser.jobId),
                getService: function() {
                    return apiFetch(`services/${endUser.serviceId}`);
                },
                vaultPan: function(pan) {
                    return vaultFetch('otp', { method: 'POST' })
                        .then(function(otp) {
                            return vaultFetch('pan', {
                                method: 'POST',
                                body: {
                                    otp: otp.id,
                                    pan: pan
                                }
                            });
                        })
                        .then(function(pan) {
                            return vaultFetch('pan/temporary', {
                                method: 'POST',
                                body: {
                                    panId: pan.id,
                                    key: pan.key
                                }
                            });
                        })
                        .then(function(temp) {
                            return temp.panToken;
                        });
                }
            };
        });
}

export function makeClientApi(options) {
    if (!options || !options.token) {
        throw new Error('No token.');
    }

    var apiUrl = options.apiUrl || defaultApiUrl;
    var vaultUrl = options.vaultUrl || defaultVaultUrl;
    var fetchApi = options.fetchApi || defaultFetch;
    var token = options.token;
    var canonicalizedApiUrl = apiUrl.slice(-1) === '/' ? apiUrl : (apiUrl + '/');
    var canonicalizedVaultUrl = vaultUrl.slice(-1) === '/' ? vaultUrl : (vaultUrl + '/');

    if (!fetchApi) {
        throw new Error('No fetch found.');
    }

    function apiFetch(path, options) {
        return fetch(canonicalizedApiUrl + path, fetchApi, token, options);
    }

    function vaultFetch(path, options) {
        return fetch(canonicalizedVaultUrl + path, fetchApi, token, options);
    }

    return apiFetch('client')
        .then(function() {
            return {
                makeJobApi: function(jobId) {
                    return makeJobApi(apiFetch, jobId);
                },
                getServices: function() {
                    return apiFetch('services');
                },
                getService: function(serviceId) {
                    return apiFetch(`services/${serviceId}`);
                },
                vaultPan: function(pan) {
                    return vaultFetch('otp', { method: 'POST' })
                        .then(function(otp) {
                            return vaultFetch('pan', {
                                method: 'POST',
                                body: {
                                    otp: otp.id,
                                    pan: pan
                                }
                            });
                        })
                        .then(function(pan) {
                            return vaultFetch('pan/temporary', {
                                method: 'POST',
                                body: {
                                    panId: pan.id,
                                    key: pan.key
                                }
                            });
                        })
                        .then(function(temp) {
                            return temp.panToken;
                        });
                }
            };
        });
}
