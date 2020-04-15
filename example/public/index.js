import { createEndUserSdk } from '/modules/@ubio/client-library.js';

// The server is a client of the ubio REST API. It creates a job using data the
// browser sends.
async function createJob(input) {
    const res = await fetch('/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
    });

    if (!res.ok) {
        throw new Error(`Unexpected status from server: ${res.status}`);
    }

    return await res.json();
}

window.start.onclick = async () => {
    window.start.onclick = null;

    const { token, jobId, serviceId } = await createJob();
    const sdk = createEndUserSdk({ token, jobId, serviceId });

    let job;
    const outputs = [];

    sdk.trackJob(async (name, error) => {
        if (name === 'error') {
            console.error(error);
        }

        if (name === 'awaitingInput') {
            job = await sdk.getJob(); // eslint-disable-line no-unused-vars

            // Render a form to ask for job.awaitingInputKey and call sdk.createJobInput.
        }

        if (name === 'createOutput') {
            const updatedOutputs = sdk.getJobOutputs();

            // Compare with outputs and append any new ones.
        }

        if (name === 'close') {
            console.log('Tracking ended.');
        }
    });
};
