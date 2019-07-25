'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { createClientSdk } = require('@ubio/client-library');

const { SERVICE_ID, CLIENT_TOKEN } = process.env;

const app = express();
const sdk = createClientSdk({ token: CLIENT_TOKEN, fetch });

app.use(express.static('public'));
app.use('/modules', express.static('web_modules'));
app.post('/create-job', bodyParser.json(), async (req, res) => {
    try {
        const { id: jobId } = await sdk.createJob({ serviceId: SERVICE_ID, input: req.body.input });
        const { token } = await sdk.getJobEndUser(jobId);

        res.status(201).send({ token, jobId, serviceId: SERVICE_ID });
    } catch (error) {
        res.status(500).send({ error });
    }
});
app.listen(3000, () => console.log('Listening on port 3000.'));
