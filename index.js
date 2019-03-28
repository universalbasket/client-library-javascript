var defaultApiUrl = 'https://api.automationcloud.net';
var defaultVaultUrl = 'https://vault.automationcloud.net';
var defaultFetch = typeof self !== 'undefined' && self.fetch && self.fetch.bind(self);
var base64Encode;

if (typeof btoa === 'function') {
    base64Encode = function(string) {
        return btoa(string);
    };
} else if (typeof Buffer === 'function') {
    base64Encode = function(string) {
        return Buffer.from(string).toString('base64');
    };
} else {
    throw new Error('No way to convert to base64.');
}

// TODO: Does service-api handle array parameters?
function createSearch(parameters) {
    if (!parameters) {
        return '';
    }

    var query = [];

    Object.keys(parameters).forEach(function(key) {
        if (parameters[key] !== void 0) {
            query.push(encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]));
        }
    });

    var search = query.join('&');

    return search.length ? '?' + search : '';
}


function fetchWrapper(url, fetch, token, opts) {
    var options = opts || {};
    var method = options.method || 'GET';
    var query = options.query;

    if (!token) {
        throw new Error('No token.');
    }

    var headers = {};

    Object.keys(options.headers || {}).forEach(function(key) {
        headers[key] = options.headers[key];
    });

    headers['Authorization'] = 'Basic ' + base64Encode(token + ':');

    var body = options.body === void 0 ? void 0 : JSON.stringify(options.body);
    var search = createSearch(query);

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

    return fetch(url + search, fetchOptions)
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

function makeApiClient(baseUrl, fetch, token) {
    var canonicalizedBaseiUrl = baseUrl.slice(-1) === '/' ? baseUrl : (baseUrl + '/');

    function apiFetch(path, options) {
        return fetchWrapper(canonicalizedBaseiUrl + path, fetch, token, options);
    }

    var api = {
        raw: function(path, options) {
            return apiFetch(path, options);
        },
        getServices: function() {
            return apiFetch('services');
        },
        getService: function(serviceId) {
            return apiFetch('services/' + serviceId);
        },
        getJobs: function(query) {
            return apiFetch('jobs', { query: query });
        },
        createJob: function(fields) {
            return apiFetch('jobs', { method: 'POST', body: fields });
        },
        getJob: function(jobId) {
            return apiFetch('jobs/' + jobId);
        },
        cancelJob: function(jobId) {
            return apiFetch('jobs/' + jobId + '/cancel', { method: 'POST' });
        },
        resetJob: function(jobId) {
            return apiFetch('jobs/' + jobId + '/reset', { method: 'POST' });
        },
        createJobInput: function(jobId, data, key, stage) {
            return apiFetch('jobs/' + jobId + '/inputs', { method: 'POST', body: { key, stage, data } });
        },
        getJobOutputs: function(jobId, key, stage) {
            var path = 'jobs/' + jobId;

            if (key) {
                path += '/' + key;

                if (stage) {
                    path += '/' + stage;
                }
            }

            return apiFetch(path);
        },
        getJobScreenshots: function(jobId) {
            return apiFetch('jobs/' + jobId + '/screenshots');
        },
        getJobScreenshot: function(jobId, id, ext) {
            return apiFetch('jobs/' + jobId + '/screenshots/' + id + '.' + ext, { parse: false })
                .then(res => res.blob());
        },
        getJobMimoLogs: function(jobId) {
            return apiFetch('jobs/' + jobId + '/mimo-logs');
        },
        getJobEndUser: function(jobId) {
            return apiFetch('jobs/' + jobId + '/end-user');
        },
        trackJob: function(jobId, callback) {
            return poll(jobId, callback, 1000); // TODO: EventSource or WebSocket.
        }
    };

    function delay(t) {
        return new Promise(function(resolve) {
            setTimeout(resolve, t);
        });
    }

    function poll(jobId, callback, dt) {
        var job;

        function run() {
            return delay(dt)
                .then(function() {
                    return api.getJob(jobId);
                })
                .then(function(updated) {
                    if (!job || updated.state !== job.state) {
                        callback(updated, job);
                    }

                    job = updated;

                    if (job.state === 'success') {
                        return;
                    }

                    if (job.state === 'fail') {
                        throw new Error('Job failed.');
                    }

                    return run();
                });
        }

        return run();
    }

    return api;
}

function makeVaultClient(baseUrl, fetch, token) {
    var canonicalizedBaseiUrl = baseUrl.slice(-1) === '/' ? baseUrl : (baseUrl + '/');

    function vaultFetch(path, options) {
        return fetchWrapper(canonicalizedBaseiUrl + path, fetch, token, options);
    }

    return {
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
}

/**
 * @param {Object} options
 * @param {string} options.token
 * @param {string} options.apiUrl
 * @param {function} options.fetch
 */
export function createClientSdk(options) {
    if (!options || !options.token) {
        throw new Error('Token required.');
    }

    var apiUrl = options.apiUrl || defaultApiUrl;
    var fetch = options.fetch || defaultFetch;
    var token = options.token;

    return makeApiClient(apiUrl, fetch, token);
}

/**
 * @param {Object} options
 * @param {string} options.token
 * @param {string} options.jobId
 * @param {string} options.serviceId
 * @param {string} options.apiUrl
 * @param {string} options.vaultUrl
 * @param {function} options.fetch
 */
export function createEndUserSdk(options) {
    if (!options || !options.token) {
        throw new Error('A token required.');
    }

    if (!options.jobId) {
        throw new Error('A jobId is required.');
    }

    if (!options.serviceId) {
        throw new Error('A serviceId is required.');
    }

    var jobId = options.jobId;
    var serviceId = options.serviceId;
    var apiUrl = options.apiUrl || defaultApiUrl;
    var vaultUrl = options.vaultUrl || defaultVaultUrl;
    var fetch = options.fetch || defaultFetch;
    var token = options.token;

    var apiClient = makeApiClient(apiUrl, fetch, token);
    var vaultClient = makeVaultClient(vaultUrl, fetch, token);

    return {
        getService: function() {
            return apiClient.getService(serviceId);
        },
        getJob: function() {
            return apiClient.getJob(jobId);
        },
        cancelJob: function() {
            return apiClient.cancelJob(jobId);
        },
        resetJob: function(jobId) {
            return apiClient.resetJob(jobId);
        },
        createJobInput: function(data, key, stage) {
            return apiClient.createJobInput(jobId, data, key, stage);
        },
        getJobOutputs: function(key, stage) {
            return apiClient.getJobOutputs(jobId, key, stage);
        },
        getJobScreenshots: function() {
            return apiClient.getJobScreenshots(jobId);
        },
        getJobScreenshot: function(id, ext) {
            return apiClient.getJobScreenshot(jobId, id, ext);
        },
        getJobMimoLogs: function() {
            return apiClient.getJobMimoLogs(jobId);
        },
        getJobEndUser: function() {
            return apiClient.getJobEndUser(jobId);
        },
        trackJob: function(callback) {
            return apiClient.trackJob(jobId, callback);
        },
        vaultPan: function(pan) {
            return vaultClient.vaultPan(pan);
        }
    };
}
