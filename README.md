⚠️ **This library is in beta and subject to change.** ⚠️

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
[unpkg.com](https://unpkg.com) (not recommended for production):

```javascript
import {
    createClientSdk,
    createEndUserSdk
} from 'https://unpkg.com/@ubio/sdk?module';

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

Your customer decides to make a purchase! On their behalf, you compose a job and
POST it to our API to create it.

```javascript
// On your server.
const { createClientSdk } = require('@ubio/sdk');
const fetch = require('node-fetch');
const token = process.env.UBIO_CLIENT_TOKEN;
const serviceId = process.env.UBIO_SERVICE_ID;
const clientSdk = createClientSdk({ fetch, token });

async function createJob(input) {
    const job = await clientSdk.createJob({ serviceId, input });
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

    // Track the job. When an event occurs the callback will be called. Errors
    // lead to the callback being called with the "error" event name and an
    // error instance.
    //
    // When the job reaches a state of "success" or "fail" tracking
    // will stop and this function will resolve. The call to trackJob returns
    // a function which, when called, will manually stop tracking.
    const close = endUserSdk.trackJob(job.id, async (eventName, error) => {
        if (eventName === 'awaitingInput') {
            // ask user for input
            const data = await getInputFromUser();

            await createJobInput(key, data);
        }

        // The 'close' event is emitted only once, and no other events will
        // follow.
        if (eventName === 'close') {
            console.log('done!');
        }
    });
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

All methods of the sdk object return a `Promise` instance except for `trackJob`.

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

#### `getPreviousJobOutputs(serviceId, inputs)`

Gets the outputs of previous jobs, optionally filtering by a list of inputs.

#### `getJobs(query)`

Get a list of your jobs. The query has the following optional fields which may
be used to refine the list:

| name | description | default |
| ---- | ----------- | ------- |
| serviceId | | none |
| state| `"processing"`, `"awaitingInput"`, `"awaitingTds"`, `"success"`, or `"fail"`. | none |
| category | One of `"live"` or `"test"`. | none |
| limit | The maximum number of jobs to respond with, from 0 to 100. | 100 |
| offset | Skip the first n jobs. | 0 |
| sort | Use `"createdAt"` to revere the sort order to ascending. | `"-createdAt"` |

#### `createJob(fields)`

Create a job with the following fields:

| name | required | description | default |
| ---- | -------- | ----------- | ------- |
| serviceId | true | | |
| callbackUrl | false | A callback URL to make a request to when particular events occur. | none |
| input | false | A prepopulated set of inputs. | `{}` |
| category | false | `"live"` or `"test"` | `"live"` |
| scriptVersion | false | A specific version of the script to use. | Defaults to the published version. |

#### `getJob(jobId)`

Gets a job.

#### `cancelJob(jobId)`

Cancels a job.

#### `resetJob(jobId, fromInputKey, preserveInputs)`

Resets a job.

#### `createJobInput(jobId, key, data)`

Creates a new input with some `data` under `key`.

#### `getJobOutputs(jobId)`

Gets the outputs of a job.

#### `getJobOutput(jobId, key)`

Gets a particular output of a job.

#### `getJobScreenshots(jobId)`

Gets the metadata for all screenshots of a job.

#### `getJobScreenshot(jobId, id)`

Gets a screenshot by jobId and id. Resolves to a blob.

#### `getJobScreenshot(path)`

The endpoint`getJobScreenshots` returns metadata for screenshots, and a `url`
field may be found in each. This field can be passed to `getJobScreenshot`
directly. Resolves to a blob.

#### `getMimoLogs(jobId)`

Gets the MIMO logs for a job by jobId.

#### `getJobEndUser(jobId)`

Gets the end-user entity associated with a job. This entity includes a token
you may use to delegate operations on the job to a customer.

#### `getJobEvents(jobId, offset = 0)`

Gets the events for a given jobId. Use the offset to skip some jobs (useful
when manually polling for new events).

#### `trackJob(jobId, callback)`

**Warning: Subject to change!**

Track a job. Returns a function which may be called to stop tracking.

The callback will be called with the event name. Job event names are:

 - `"restart"`
 - `"success"`
 - `"fail"`
 - `"awaitingInput"`
 - `"createOutput"`
 - `"tdsStart"`
 - `"tdsFinish`"`

Two special events may also be emitted:

 - `"error"`
 - `"close"`

When called with the `"error"` event name, the second parameter will be an error
object. In the future other events may also come with data like this.

The `"close"` event is always the last event and happens only once. It occurs
after certain errors (particularly 4xy request errors), after `"success"` or
`"fail"` events, or after the function returned by the call to `trackJob` is
called. It will only be emitted once.

## end-user API

### Instantiating

The end-user API requires an end-user `token`, a `serviceId`, and a `jobId`.

```javascript
const sdk = createClientSdk({
    token,     // required
    serviceId, // required
    jobId,     // required
    fetch,     // required in Node
    apiUrl,    // optional, defaults to api.automationcloud.net
    vaultUrl   // optional, defaults to vault.automationcloud.net
})
```

### Methods

All methods of the sdk object return a `Promise` instance except for `trackJob`
and `vaultPan`.

#### `getService()`

Gets the service which this `sdk` instance is associated with.

#### `getJob()`

Gets the job which this `sdk` is associated with.

#### `cancelJob()`

Cancels the job which this `sdk` is associated with.

#### `resetJob(fromInputKey, preserveInputs)`

Resets the job which this `sdk` is associated with.

#### `createJobInput(key, data)`

Creates an input for the job which this `sdk` is associated with, under `key`.

#### `getJobOutputs()`

Gets the outputs of the job which this `sdk` is associated with.

#### `getJobOutput(key)`

Gets the output of the job which this `sdk` is associated with, under `key`.

#### `getJobScreenshots()`

Gets the metadata of screenshots for the job which this `sdk` is associated
with.

#### `getJobScreenshot(id)`

Gets a screenshot the job which this `sdk` is associated with by `id`.

#### `getJobScreenshot(path)`

The `getJobScreenshots` method returns a list of metadata of screenshots. Each
includes a `url` field, which may be used to call `getJobScreenshot`.

#### `getJobMimoLogs()`

Gets the MIMO logs for the job which this `sdk` is associated with.

#### `getJobEvents(offset = 0)`

Gets events for the job which this `sdk` is associated with. When an offset is
given, that number of events will be skipped.

#### `trackJob`

Tracks the events of the job which this `sdk` is associated with. See the
same-named method of the client sdk for more information.

#### `vaultPan`

Sends a PAN to the vault. Resolves to a token to use in its stead.
