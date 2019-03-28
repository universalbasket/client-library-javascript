import { createEndUserSdk } from '/sdk.js';

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

async function listenForJobChanges({ token, jobId, serviceId }) {
    // const sdk = createEndUserSdk({ token, jobId,  })
    const sdk = createEndUserSdk({ token, jobId, serviceId });

    window.sdk = sdk;

    await sdk.trackJob((current, previous) => {
        console.log(`state change from ${previous.state} to ${current.state}.`);
    });
}

window.start.onclick = async () => {
    window.start.onclick = null;

    const { token, jobId, serviceId } = await createJob();

    await listenForJobChanges({ token, jobId, serviceId });
};
