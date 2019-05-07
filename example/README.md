# UBIO JavaScript SDK client and server example

This directory contains an expressed based server. This server accepts POST
requests which direct it to create a new job as a `client` entity of the  UBIO
REST API, and responds with an `end-user` token, job ID, and service ID.

In addition to this endpoint, the server serves a page which demonstrates the
`end-user` usage of the JavaScript API.

To use, you must start the server using a client token:

```shell
SERVICE_ID=<your-service-id> CLIENT_TOKEN=<your-client-token> node .
```

**This code is for demonstration only.** It is incomplete, and not secure. It is
intended only to demonstrate the suggested usage of the JavaScript SDK.
