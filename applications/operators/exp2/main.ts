// main.ts
import cron from 'node-cron';
import moment from 'moment';

import { config } from './config';
import { scaleDeployment } from './k8s-management/deployments';
import { getMessagesInQueue } from './external/kafka';
import { findOptimalExecutionWindows, loadAndSortEnergyData } from './external/carbon_intensity';
import {
    initDatabase,
    storeOptimalWindows,
    getOptimalWindows,
    logScalingEvent,
    closeDatabase,
    Window
} from './database';

// Function that runs at midnight every day to fetch optimal windows
async function fetchDailyOptimalWindows(): Promise<Window[]> {
    console.log('🔍 Fetching optimal execution windows for today...');

    const today = moment().format('YYYY-MM-DD');

    try {
        // Use your existing functions to get the data
        const hourValueData = await loadAndSortEnergyData();

        // Find optimal windows using your existing function
        const optimalWindows = findOptimalExecutionWindows(hourValueData, {
            percentile: config.carbonIntensity.percentile,
            windowSize: config.carbonIntensity.windowSize,
            maxWindows: config.carbonIntensity.maxWindows
        }) as Window[];

        console.log("\nOptimal execution windows for today:");
        optimalWindows.forEach(window => {
            console.log(`Hours ${window.start}-${window.end} (${window.length} hours) with avg intensity: ${window.avgIntensity}`);
        });

        // Store the windows for later use
        await storeOptimalWindows(today, optimalWindows);

        return optimalWindows;
    } catch (err) {
        console.error('❌ Failed to fetch optimal windows:', err);
        return [];
    }
}

// Function that runs every hour to check if we're in an optimal window
async function hourlyScalingCheck(): Promise<void> {
    console.log('⏱️ Running hourly scaling check...');

    try {
        // Get current time data
        const now = moment();
        const today = now.format('YYYY-MM-DD');
        const currentHour = now.hour();

        console.log(`Current date: ${today}, hour: ${currentHour}`);

        // Load today's optimal windows
        let optimalWindows = await getOptimalWindows(today);

        // If no windows found for today, fetch them
        if (optimalWindows.length === 0) {
            console.log('🔄 No optimal window data for today, fetching...');
            optimalWindows = await fetchDailyOptimalWindows();
        }

        // Check if the current hour is within any optimal window
        const isOptimalHour = optimalWindows.some(window =>
            currentHour >= window.start && currentHour <= window.end
        );

        // If we're going to scale down, check queue size first
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

        // Now correctly call scaleDeployment with 3 arguments
        if (isOptimalHour) {
            const targetReplicas = config.kubernetes.deployments.taskRunner.maxReplicas;
            const reason = `Current hour (${currentHour}) is in optimal window`;

            console.log(`🟢 ${reason} - scaling up to ${targetReplicas}`);

            await scaleDeployment(
                config.kubernetes.deployments.taskRunner.name,
                config.kubernetes.namespace,
                targetReplicas
            );

            // Log the event
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
            const reason = `Current hour (${currentHour}) is NOT in optimal window`;

            console.log(`🔴 ${reason} - scaling down to ${targetReplicas}`);

            await scaleDeployment(
                config.kubernetes.deployments.taskRunner.name,
                config.kubernetes.namespace,
                targetReplicas
            );

            // Log the event
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
        console.error('❌ Error in hourly scaling check:', err);
    }
}

async function main(): Promise<void> {
    console.log('🚀 Starting energy-optimal scheduling system');

    try {
        await initDatabase(config.database.path);
        console.log(`📊 Database initialized at ${config.database.path}`);

        cron.schedule('0 0 * * *', fetchDailyOptimalWindows);
        cron.schedule('0 * * * *', hourlyScalingCheck);

        await fetchDailyOptimalWindows();
        await hourlyScalingCheck();

        console.log('✅ Energy-optimal scaling system is running');
    } catch (err) {
        console.error('❌ Failed to initialize the system:', err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});