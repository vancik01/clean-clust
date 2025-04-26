import axios from "axios";
import { config } from "../config";



const query = 'avg by (instance)(sum by (instance, cpu)(rate(node_cpu_seconds_total{mode!~"idle|iowait|steal", cluster="", job="node-exporter"}[5m]))) * on(instance) group_left(nodename) node_uname_info';

async function queryPrometheusRange() {
    try {
        const now = Math.floor(Date.now() / 1000); // current time in seconds
        const start = now - 3600; // one hour ago
        const step = 60; // 60 seconds (1 minute) step
        const response = await axios.get(`${config.monitoring.prometheusUrl}/api/v1/query_range`, {
            params: {
                query: query,
                start: start,
                end: now,
                step: step,
            },
        });

        if (response.data.status === 'success') {
            console.log('Query Range Result:', JSON.stringify(response.data.data, null, 2));
        } else {
            console.error('Query failed:', response.data.error);
        }
    } catch (error) {
        console.error('Error querying Prometheus:', error);
    }
}