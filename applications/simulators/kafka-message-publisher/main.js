const { Kafka } = require('kafkajs');
const kafka = new Kafka({
    clientId: 'message-producer',
    brokers: ['localhost:9093']  // Changed from kafka.kafka.svc.cluster.local:9092
});

const producer = kafka.producer();
const topic = 'workload-run-topic';

async function sendMessage(message) {
    try {
        await producer.connect();

        await producer.send({
            topic,
            messages: [
                { value: JSON.stringify(message) }
            ],
        });

        console.log(`Message sent: ${JSON.stringify(message)}`);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

async function runProducer() {
    try {
        // send messages with incremental IDs indefinitely
        let i = 0;

        while (true) {
            const message = {
                id: i,
                text: `Process workload with ID: ${i}`,
                timestamp: new Date().toISOString()
            };

            await sendMessage(message);
            console.log(`Sent message #${i}`);
            i++;

            // simulate delay between messages (1-2 seconds)
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        }
    } catch (err) {
        console.error('Error in producer:', err);
    }
}

// Run the producer
runProducer().catch(console.error);