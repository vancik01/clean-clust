// main-simulated.ts
import moment from 'moment';
import { config } from './config';
import {
    initDatabase,
    storeOptimalWindows,
    getOptimalWindows,
    logScalingEvent,
    closeDatabase,
    Window
} from './database';
import { findOptimalExecutionWindows, loadAndSortEnergyData } from './external/carbon_intensity';
import { getMessagesInQueue } from './external/kafka';
import { scaleDeployment } from './k8s-management/deployments';

// Simulation settings
const MINUTE_PER_HOUR = 1; // Each hour runs for 1 minute
const SIMULATION_SPEED = 60000; // 60 seconds per hour (in ms)

// Override current time for simulation
class TimeSimulator {
    private currentHour: number = 0;

    constructor() {
        // Start at midnight
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

// Function to fetch optimal windows from the real API
async function fetchDailyOptimalWindows(): Promise<Window[]> {
    console.log('🔍 Fetching optimal execution windows from real API...');

    try {
        // Use the real API to get carbon intensity data
        const hourValueData = await loadAndSortEnergyData();

        // Find optimal windows using the real function
        const optimalWindows = findOptimalExecutionWindows(hourValueData, {
            percentile: config.carbonIntensity.percentile,
            windowSize: config.carbonIntensity.windowSize,
            maxWindows: config.carbonIntensity.maxWindows
        }) as Window[];

        console.log("\nOptimal execution windows:");
        optimalWindows.forEach(window => {
            console.log(`Hours ${window.start}-${window.end} (${window.length} hours) with avg intensity: ${window.avgIntensity}`);
        });

        // Store the real data in the database
        const today = moment().format('YYYY-MM-DD');
        await storeOptimalWindows(today, optimalWindows);

        return optimalWindows;
    } catch (err) {
        console.error('❌ Failed to fetch optimal windows:', err);
        return [];
    }
}

// Function to perform actual scaling based on the current hour
async function performHourlyScaling(timeSimulator: TimeSimulator, optimalWindows: Window[]): Promise<void> {
    const currentHour = timeSimulator.getCurrentHour();
    console.log(`\n===== SIMULATION HOUR: ${timeSimulator.formatCurrentTime()} =====`);

    try {
        // Check if the current hour is within any optimal window
        const isOptimalHour = optimalWindows.some(window =>
            currentHour >= window.start && currentHour <= window.end
        );

        // Get the actual message queue size from Kafka
        if (!isOptimalHour && currentHour !== 0) {  // Skip lag check at midnight
            const lag = await getMessagesInQueue({
                brokers: config.kafka.brokers,
                clientId: config.kafka.clientId,
                groupId: config.kafka.groupId,
                topic: config.kafka.topic,
            });

            console.log(`🕒 Current Kafka consumer lag: ${lag}`);

            // Don't scale down if there are still messages to process
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

        // Perform actual scaling based on optimal hour
        if (isOptimalHour) {
            const targetReplicas = config.kubernetes.deployments.taskRunner.maxReplicas;
            const reason = `Hour ${currentHour} is in optimal window`;

            console.log(`🟢 ${reason} - scaling up to ${targetReplicas}`);

            // Actually scale the deployment
            await scaleDeployment(
                config.kubernetes.deployments.taskRunner.name,
                config.kubernetes.namespace,
                targetReplicas
            );

            // Log the scaling event
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

            // Actually scale the deployment
            await scaleDeployment(
                config.kubernetes.deployments.taskRunner.name,
                config.kubernetes.namespace,
                targetReplicas
            );

            // Log the scaling event
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

// Main function to run the accelerated simulation
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
            // Advance to next hour
            timeSimulator.advanceHour();
            const currentHour = timeSimulator.getCurrentHour();

            // If we've completed a full day, stop the simulation
            if (currentHour === 0) {
                clearInterval(intervalId);
                console.log('\n===== SIMULATION COMPLETE (FULL 24 HOURS) =====');
                await closeDatabase();
                process.exit(0);
            } else {
                // Otherwise, perform the scaling for this hour
                await performHourlyScaling(timeSimulator, optimalWindows);
            }
        }, SIMULATION_SPEED);

        // Allow for CTRL+C to stop the simulation
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