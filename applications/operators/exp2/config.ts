// config.ts
import path from 'path';

export const config = {
    kubernetes: {
        namespace: "testing",
        deployments: {
            taskRunner: {
                name: "kafka-task-runner",
                maxReplicas: 5,
                minReplicas: 0
            }
        }
    },
    kafka: {
        brokers: ["localhost:9093"],
        clientId: "task-runner",
        groupId: "task-group",
        topic: "workload-run-topic"
    },
    carbonIntensity: {
        percentile: 30,
        windowSize: 2,
        maxWindows: 3
    },
    database: {
        path: path.join(__dirname, 'data', 'energy-optimizer.db')
    },
    scheduling: {
        queueSizeThreshold: 10  // Max number of messages to allow scale down
    }
};