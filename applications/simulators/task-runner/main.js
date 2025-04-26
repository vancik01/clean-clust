// const path = require('path')
// require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const { Kafka } = require('kafkajs');

let isShuttingDown = false;
let currentTask = null;

console.log('🛠 ENV KAFKA_BROKERS =', process.env.KAFKA_BROKERS);


const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID,
    brokers: process.env.KAFKA_BROKERS.split(','),
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });
const topic = process.env.KAFKA_TOPIC;

async function runTask(duration = 5000) {
    console.log(`🚀 Starting task for ${duration}ms...`);
    const start = Date.now();
    while (Date.now() - start < duration) {
        Math.random() * Math.random();
    }
    console.log(`✅ Task completed after ${Date.now() - start}ms`);
}

async function startConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    console.log(`Consumer started. Listening for tasks on topic: ${topic}`);

    await consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
            if (isShuttingDown) return;

            console.log(`📥 Received message from ${topic}[${partition}]`);
            console.log(message.value.toString());

            currentTask = runTask();

            try {
                await currentTask;
                if (!isShuttingDown) {
                    await consumer.commitOffsets([{
                        topic,
                        partition,
                        offset: (parseInt(message.offset) + 1).toString()
                    }]);
                }
            } catch (error) {
                console.error('Error processing task:', error);
            }

            currentTask = null;
        },
    });
}

async function shutdown(signal) {
    console.log(`\n⚠️ Received ${signal} - Starting graceful shutdown...`);

    if (isShuttingDown) return;
    isShuttingDown = true;

    consumer.pause([{ topic }]);

    if (currentTask) {
        console.log('⏳ Waiting for current task to complete...');
        try {
            await currentTask;
        } catch (error) {
            console.error('Error completing task during shutdown:', error);
        }
    }

    try {
        await consumer.disconnect();
        console.log('✅ Consumer disconnected');
    } catch (error) {
        console.error('Error disconnecting consumer:', error);
    }

    console.log('🏁 Graceful shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startConsumer().catch(console.error);
