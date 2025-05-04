console.log('Starting simulated user request application...');

function simulateUserRequest() {
    console.log(`Processing request`);

    const startTime = process.hrtime();
    let result = 0;
    const iterations = Math.floor(Math.random() * 400000) + 100000;

    for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i) * Math.sin(i);
    }

    const hrend = process.hrtime(startTime);
    const executionTimeMs = hrend[0] * 1000 + hrend[1] / 1000000;

    console.log(`Completed in ${executionTimeMs.toFixed(2)}ms`);
}

function scheduleNextRequest() {
    const randomDelay = Math.floor(Math.random() * 450) + 50; // 50-500ms

    setTimeout(() => {
        simulateUserRequest();
        scheduleNextRequest();
    }, randomDelay);
}

scheduleNextRequest();

console.log('Application running - simulating continuous user requests...');

process.on('SIGINT', () => {
    console.log('Application terminating...');
    process.exit(0);
});