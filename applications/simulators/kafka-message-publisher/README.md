# Kafka Message Publisher
This Node.js application is used for Use case 2: Temporal Workload Offloading. It simulates continuous message generation to a Kafka topic, creating a workload messages that can be used to test task scheduling and offloading strategies.

This aplication connects to a Kafka broker within the cluster and publishes messages at random intervals between 1-2 seconds which simulate real worlds tasks ready that needs to be executed.