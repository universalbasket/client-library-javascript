# JavaScript Software Development Kit (SDK) for UBIO

This SDK may be used by a client or an end-user of UBIO, with slightly differing
functionality.

## Installing

The SDK is provided as both a UMD module and an ES6 module, which are in both
cases a single file. This allows the module to be used in most deployment and
bundling scenarios (and lack thereof). It may also be used with node (see
below).

To install with npm, use:

```shell
npm install @ubio/sdk
```

If you're using pika for your client side modules:

```shell
npm install @ubio/sdk
npx @pika/web
```

If you want to quickly try out this module you can use
[unpkg.com][https://unpkg.com] (not recommended for production):

```javascript
import { createClientSdk, createEndUserSdk } from 'https://unpkg.com/@ubio/sdk?module';

// ...
```

You may also use the module as an old fashioned global:

```html
<script src="https://unpkg.com/@ubio/sdk"></script>
<script>
    var endUserSdk = ubioSdk.createEndUserSdk({ /* ... */ });
</script>
```

You cam also use this module with [Browserify](http://browserify.org/),
[webpack](https://webpack.js.org/), [RequireJS](https://requirejs.org/)... you
get the picture.

This library requires `fetch` and `Promise` to work. If you need to support
older browsers, then you must polyfill these. Since Node doesn't include
`fetch`, you should pass an equivalent function in as an argument:

```javascript
const { createClientSdk } = require('@ubio/sdk');
const fetch = require('node-fetch');

const clientSdk = createClientSdk({ fetch, /* ... */ });
```

## Clients and End-Users

This library is intended for two use cases. As a client, you have the ability
to create jobs. Each time a job is created, we also create an "end-user" entity.
This entity has the ability to perform actions on a specific job. The intent is
that you create a job on behalf of a customer, and then this library may be used
in their browser with end-user authentication to update the job and allow it to
progress.

This library provides two interfaces, one for the you (client), and one for your
customers (end-users). As a client, you must be the one to create a job on
behalf of your client. This library may be used as part of a Node.js service to
do that (however, you might also prefer to use the API directly, in which case
the code for this client may be useful to you as a reference).

## The client flow

Your customer decides to make a purchase! On their behalf, you compose a job,
and POST it to our API to formally create it.

```javascript
// On your server.
const { createClientSdk } = require('@ubio/sdk');
const fetch = require('node-fetch');
const token = process.env.UBIO_CLIENT_TOKEN;
const serviceId = process.env.UBIO_SERVICE_ID;
const scriptVersion = process.end.UBIO_SCRIPT_VERSION;
const clientSdk = createClientSdk({ fetch, token });

async function createJob(input) {
    const job = await clientSdk.createJob({ serviceId, scriptVersion, input });
    const endUser = await clientSdk.getJobEndUser(job.id);

    return endUser; // Contains jobId, serviceId, and token fields.
}
```

After creating the job, you can get the end-user entity using the `jobId`. The
end-user `token`, the `jobId`, and the `serviceId` must be sent back to your
customer so that JavaScript in their browser can use these to create an end-user
SDK object.

```javascript
// In the customer browser.
import { createEndUserSdk } from '@ubio/sdk';

// Function is called with an object with inputs when the customer decides to
// make a purchase.
async function onSubmit(input) {
    const res = fetch('/this/goes/to/you/see/above/snippet/', {
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input }),
        // ...
    });

    if (!res.ok) {
        throw new Error('Unexpected response from your server.');
    }

    const endUser = await res.json();
    const endUserSdk = createEndUserSdk({
        token: endUser.token,
        jobId: endUser.jobId,
        serviceId: endUser.serviceId
    });

    // Track the job. On state change, the callback will be called
    // with the current job object and the previous job object.
    // When the job reaches a state of "success" or "fail" tracking
    // will stop and this function will resolve.
    await endUserSdk.trackJob(job.id, async (current, previous) => {
        if (current.state === 'awaitingInput') {
            // ask user for input
            const data = await getInputFromUser();

            await createJobInput(data, key);
        }
    });

    console.log('done!');
}
```

## Client API

### Instantiating

The client API requires a client token.

```javascript
const sdk = createClientSdk({
    token, // required
    fetch, // required in Node
    apiUrl // optional, defaults to api.automationcloud.net
})
```

### Methods

All methods of the sdk object return a `Promise` instance.

#### body

The body, when given, should be an object, not a string. This library handles
stringification for you.

#### query

A query may be given as an object. This library will properly format it and
append it to the url for you.

#### `raw(path, options)`

For cases when you need to make requests to our API which are not covered by
explicit API methods (this should be rare), you may use the `raw` method.
Underneath its fetch doing the heavy lifting. The path is an API path you wish
to make a request to, and options is the same as it is for fetch, but with a few
differences:

- Automatic error handling. When our API responds with a 4xy or 5xy error, this
  method parses the following body and throws it as an error.
- Automatic response body parsing. This library parses responses directly into
  objects. If you need the response object instead, set `options.parse` to
  `false`.
- Automatic request body stringification. When posting, set `options.body` with
  an object, not a string.
- Automatic search string formatting. When you need to use a query, set the
  `options.query` field with an object. There's no need to format this yourself
  and append it to the path.

#### `getServices()`

Get a list of your services.

#### `getService(serviceId)`

Get a single service by its ID.

#### `getJobs(query)`

Get a list of your jobs. The query has the following optional fields which may
be used to refine the list:

```javascript
{
    serviceId,
    state,     // one of 'processing', 'awaitingInput', 'awaitingTds', 'success', or 'fail'
    category,  // one of 'live' or 'test
    limit,     // a number from 0 to 100, defaulting to 100
    offset,    // an offset, defaulting to 0
    sort       // use "createdAt" to reverse the order of the sort to ascending
}
```
