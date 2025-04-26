import axios from 'axios';
import { config } from '../config';

interface BatteryTrend {
    node: string;
    currentLevel: number;
    trend: 'rising' | 'falling' | 'stable';
}

export async function fetchBatteryLevelsAndTrends(): Promise<BatteryTrend[]> {
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutesAgo = now - 300; // 5 minutes ago

    try {
        const query = 'node_solar_battery_level';

        const [currentResponse, historicalResponse] = await Promise.all([
            axios.get(`${config.monitoring.prometheusUrl}/api/v1/query`, {
                params: { query },
            }),
            axios.get(`${config.monitoring.prometheusUrl}/api/v1/query_range`, {
                params: {
                    query,
                    start: fiveMinutesAgo,
                    end: now,
                    step: 60, // 1-minute intervals
                },
            }),
        ]);

        if (currentResponse.data.status !== 'success' || historicalResponse.data.status !== 'success') {
            throw new Error('Prometheus query failed');
        }

        const currentLevels: Record<string, number> = {};
        currentResponse.data.data.result.forEach((result: any) => {
            const node = result.metric.node || result.metric.instance || 'unknown-node';
            currentLevels[node] = parseFloat(result.value[1]);
        });

        const trends: BatteryTrend[] = historicalResponse.data.data.result.map((result: any) => {
            const node = result.metric.node || result.metric.instance || 'unknown-node';
            const values: [number, string][] = result.values;

            if (!values || values.length < 2) {
                return { node, currentLevel: currentLevels[node] || 0, trend: 'stable' };
            }

            const batteryLevels = values.map(v => parseFloat(v[1]));
            const initialLevel = batteryLevels[0];
            const currentLevel = batteryLevels[batteryLevels.length - 1];

            let trend: 'rising' | 'falling' | 'stable' = 'stable';

            if (currentLevel - initialLevel > 2) {
                trend = 'rising';
            } else if (initialLevel - currentLevel > 2) {
                trend = 'falling';
            }

            return { node, currentLevel, trend };
        });

        return trends;
    } catch (error) {
        console.error("Error fetching battery levels and trends from Prometheus:", error);
        throw error;
    }
}