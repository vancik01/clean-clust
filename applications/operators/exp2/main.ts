import moment from 'moment';
import { config } from './config';
import {
    initDatabase,
    storeOptimalWindows,
    logScalingEvent,
    closeDatabase,
} from './database';
import { findOptimalExecutionWindows, loadAndSortEnergyData } from './external/carbon_intensity';
import { getMessagesInQueue } from './external/kafka';
import { scaleDeployment } from './k8s-management/deployments';
import { Window } from './types';

const MINUTE_PER_HOUR = 1; // Each hour runs for 1 minute
const SIMULATION_SPEED = 60000; // 60 seconds per hour (in ms)

class TimeSimulator {
    private currentHour: number = 0;

    constructor() {
        this.currentHour = 0;
    }

    getCurrentHour(): number {
        return this.currentHour;
    }

    advanceHour(): number {
        this.currentHour = (this.currentHour + 1) % 24;
        return this.currentHour;
    }

    formatCurrentTime(): string {
        return `${String(this.currentHour).padStart(2, '0')}:00`;
    }
}

async function fetchDailyOptimalWindows(): Promise<Window[]> {
    console.log('🔍 Fetching optimal execution windows from real API...');

    try {
        const hourValueData = await loadAndSortEnergyData();

        const optimalWindows = findOptimalExecutionWindows(hourValueData, {
            percentile: config.carbonIntensity.percentile,
            windowSize: config.carbonIntensity.windowSize,
            maxWindows: config.carbonIntensity.maxWindows
        }) as Window[];

        console.log("\nOptimal execution windows:");
        optimalWindows.forEach(window => {
            console.log(`Hours ${window.start}-${window.end} (${window.length} hours) with avg intensity: ${window.avgIntensity}`);
        });

        const today = moment().format('YYYY-MM-DD');
        await storeOptimalWindows(today, optimalWindows);

        return optimalWindows;
    } catch (err) {
        console.error('❌ Failed to fetch optimal windows:', err);
        return [];
    }
}


async function performHourlyScaling(timeSimulator: TimeSimulator, optimalWindows: Window[]): Promise<void> {
    const currentHour = timeSimulator.getCurrentHour();
    console.log(`\n===== SIMULATION HOUR: ${timeSimulator.formatCurrentTime()} =====`);


    try {
        const isOptimalHour = optimalWindows.some(window =>
            currentHour >= window.start && currentHour <= window.end
        );

        const lag = await getMessagesInQueue({
            brokers: config.kafka.brokers,
            clientId: config.kafka.clientId,
            groupId: config.kafka.groupId,
            topic: config.kafka.topic,
        });

        console.log(`🕒 Current Kafka consumer lag: ${lag}`);

        if (!isOptimalHour && currentHour !== 0) {

            if (lag > config.scheduling.queueSizeThreshold) {
                console.log(`⚠️ Not scaling down due to ${lag} messages still in queue`);

                // Log this decision
                await logScalingEvent({
                    timestamp: new Date().toISOString(),
                    hour: currentHour,
                    deploymentName: config.kubernetes.deployments.taskRunner.name,
                    namespace: config.kubernetes.namespace,
                    targetReplicas: -1, // Indicate no change
                    reason: `Skipped scale-down due to queue size (${lag} messages)`
                });

                return;
            }
        }

        if (isOptimalHour) {
            const targetReplicas = config.kubernetes.deployments.taskRunner.maxReplicas;
            const reason = `Hour ${currentHour} is in optimal window`;

            console.log(`🟢 ${reason} - scaling up to ${targetReplicas}`);

            await scaleDeployment(
                config.kubernetes.deployments.taskRunner.name,
                config.kubernetes.namespace,
                targetReplicas
            );

            await logScalingEvent({
                timestamp: new Date().toISOString(),
                hour: currentHour,
                deploymentName: config.kubernetes.deployments.taskRunner.name,
                namespace: config.kubernetes.namespace,
                targetReplicas,
                reason
            });
        } else {
            const targetReplicas = config.kubernetes.deployments.taskRunner.minReplicas;
            const reason = `Hour ${currentHour} is NOT in optimal window`;

            console.log(`🔴 ${reason} - scaling down to ${targetReplicas}`);

            await scaleDeployment(
                config.kubernetes.deployments.taskRunner.name,
                config.kubernetes.namespace,
                targetReplicas
            );

            await logScalingEvent({
                timestamp: new Date().toISOString(),
                hour: currentHour,
                deploymentName: config.kubernetes.deployments.taskRunner.name,
                namespace: config.kubernetes.namespace,
                targetReplicas,
                reason
            });
        }
    } catch (err) {
        console.error('❌ Error in scaling:', err);
    }
}

async function main() {
    console.log(`🚀 Starting accelerated simulation (${MINUTE_PER_HOUR} minute = 1 hour)`);

    try {
        // Initialize database
        await initDatabase(config.database.path);
        console.log('✅ Database initialized');

        // Create time simulator
        const timeSimulator = new TimeSimulator();

        // Fetch optimal windows from real API
        const optimalWindows = await fetchDailyOptimalWindows();

        console.log(`\n⏱️ Starting 24-hour simulation, each hour runs for ${MINUTE_PER_HOUR} minute...`);

        // Run initial scaling for hour 0
        await performHourlyScaling(timeSimulator, optimalWindows);

        // Set up interval to run each "hour"
        const intervalId = setInterval(async () => {
            timeSimulator.advanceHour();
            const currentHour = timeSimulator.getCurrentHour();

            if (currentHour === 0) {
                clearInterval(intervalId);
                console.log('\n===== SIMULATION COMPLETE (FULL 24 HOURS) =====');
                await closeDatabase();
                process.exit(0);
            } else {
                await performHourlyScaling(timeSimulator, optimalWindows);
            }
        }, SIMULATION_SPEED);

        process.on('SIGINT', async () => {
            clearInterval(intervalId);
            console.log('\n===== SIMULATION STOPPED BY USER =====');
            await closeDatabase();
            process.exit(0);
        });

        console.log('\nSimulation running... Press CTRL+C to stop.');
    } catch (err) {
        console.error('❌ Simulation failed:', err);
        await closeDatabase();
        process.exit(1);
    }
}

// Start the simulation
main().catch(async (err) => {
    console.error('Fatal error:', err);
    await closeDatabase();
    process.exit(1);
});