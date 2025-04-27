const { Kafka } = require('kafkajs');
const kafka = new Kafka({
    clientId: 'message-producer',
    brokers: ['kafka-0.kafka.kafka.svc.cluster.local:9092']
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

            // simulate delay between messages (1-3 seconds)
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 4000));
        }
    } catch (err) {
        console.error('Error in producer:', err);
    }
}

runProducer().catch(console.error);