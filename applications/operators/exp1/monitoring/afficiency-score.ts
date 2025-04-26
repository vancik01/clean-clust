import axios from 'axios';
import { min, max } from 'mathjs';

// Prometheus API endpoint
const PROMETHEUS_URL = 'http://your-prometheus-server/api/v1/query';

// Define the structure of Prometheus metric responses
interface PrometheusResponse {
    status: string;
    data: {
        resultType: string;
        result: Array<{
            metric: { instance: string };
            value: [number, string];
        }>;
    };
}

// Define a type for storing node metrics
type NodeMetrics = Record<string, number>;

// PromQL queries for different metrics
const queries: Record<string, string> = {
    cpuUsage: '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    memoryUsage: '100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))',
    ioSpeed: 'rate(node_disk_read_bytes_total[5m]) + rate(node_disk_written_bytes_total[5m]) / 1048576',
    latency: 'avg_over_time(node_network_receive_packets_total[5m]) / avg_over_time(node_network_transmit_packets_total[5m])'
};

// Function to fetch Prometheus metrics
async function fetchMetric(query: string): Promise<NodeMetrics> {
    try {
        const response = await axios.get<PrometheusResponse>(PROMETHEUS_URL, { params: { query } });
        const data = response.data.data.result;

        return data.reduce((acc: NodeMetrics, item) => {
            acc[item.metric.instance] = parseFloat(item.value[1]);
            return acc;
        }, {});
    } catch (error) {
        console.error(`Error fetching data for query: ${query}`, error);
        return {};
    }
}

// Normalize a metric to a range of [0,1]
function normalize(values: number[], isLowerBetter: boolean = true): number[] {
    const minValue = min(values) as number;
    const maxValue = max(values) as number;

    return values.map(value => {
        if (maxValue === minValue) return 0.5; // Avoid division by zero
        return isLowerBetter
            ? 1 - ((value - minValue) / (maxValue - minValue))
            : (value - minValue) / (maxValue - minValue);
    });
}

// Compute efficiency score based on Prometheus metrics
async function calculateEfficiencyScore(): Promise<void> {
    try {
        // Fetch all metrics in parallel
        const metricsArray = await Promise.all(Object.entries(queries).map(([_, query]) => fetchMetric(query)));
        const [cpuUsage, memoryUsage, ioSpeed, latency] = metricsArray;

        // Get the list of nodes from CPU metrics
        const nodes = Object.keys(cpuUsage);
        if (nodes.length === 0) {
            console.log("No nodes found. Check Prometheus connection.");
            return;
        }

        // Convert metrics into arrays
        const cpuValues = nodes.map(node => cpuUsage[node] || 0);
        const memoryValues = nodes.map(node => memoryUsage[node] || 0);
        const ioValues = nodes.map(node => ioSpeed[node] || 0);
        const latencyValues = nodes.map(node => latency[node] || 0);

        // Normalize the values
        const cpuNorm = normalize(cpuValues, true);
        const memoryNorm = normalize(memoryValues, true);
        const ioNorm = normalize(ioValues, false);
        const latencyNorm = normalize(latencyValues, true);

        // Define weight factors (adjust as needed)
        const w1 = 0.3, w2 = 0.3, w3 = 0.3, w4 = 0.1;

        // Compute efficiency scores
        const efficiencyScores = nodes.map((node, i) => ({
            node,
            score: (w1 * cpuNorm[i]) + (w2 * memoryNorm[i]) + (w3 * ioNorm[i]) - (w4 * latencyNorm[i])
        }));

        // Sort nodes by efficiency score (higher is better)
        efficiencyScores.sort((a, b) => b.score - a.score);

        // Print results
        console.log("\nNode Efficiency Scores:");
        efficiencyScores.forEach(({ node, score }) => {
            console.log(`Node: ${node}, Efficiency Score: ${score.toFixed(3)}`);
        });

    } catch (error) {
        console.error("Error computing efficiency score:", error);
    }
}

// Run the efficiency score calculation
calculateEfficiencyScore();
