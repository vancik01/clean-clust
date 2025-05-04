import cron from 'node-cron';
import { getActiveDeployments, placePodsAffinity } from './k8s-management/deployments';
import { config } from './config';
import { getAllNodesWithLabels } from './k8s-management/nodes';
import { fetchBatteryLevelsAndTrends } from './external/battery_levels';

const BASE_THRESHOLD = config.rescheduling.BASE_THRESHOLD;
const THRESHOLD_OFFSET = config.rescheduling.THRESHOLD_OFFSET;

async function prioritizeSolarNodesBasedOnBatteryTrends() {
    try {
        const nodes = await getAllNodesWithLabels();
        const solarNodes = nodes.filter(n => n?.labels?.power === 'solar').map(n => n.name);

        if (solarNodes.length === 0) {
            console.log(`[${new Date().toISOString()}] No solar-powered nodes found.`);
            return;
        }

        const batteryTrends = await fetchBatteryLevelsAndTrends();
        const activeDeployments = await getActiveDeployments(config.applyForNamespaces);

        for (const deployment of activeDeployments) {
            for (const solarNode of solarNodes) {
                const nodeTrend = batteryTrends.find(bt => bt.node === solarNode);

                if (!nodeTrend) {
                    console.log(`[${new Date().toISOString()}] No battery data found for node ${solarNode}. Skipping.`);
                    continue;
                }

                let adjustedThreshold = BASE_THRESHOLD;

                if (nodeTrend.trend === 'falling') {
                    adjustedThreshold -= THRESHOLD_OFFSET;
                } else if (nodeTrend.trend === 'rising') {
                    adjustedThreshold += THRESHOLD_OFFSET;
                }

                console.log(
                    `[${new Date().toISOString()}] Node "${solarNode}" battery ${nodeTrend.currentLevel}% (${nodeTrend.trend}), adjusted threshold: ${adjustedThreshold}%`
                );

                if (nodeTrend.currentLevel >= adjustedThreshold) {
                    await placePodsAffinity(deployment.namespace, deployment.deploymentName, solarNode || "", false);
                    console.log(
                        `[${new Date().toISOString()}] Deployment "${deployment.deploymentName}" prioritized to node "${solarNode}".`
                    );
                    break; // Deployment prioritized, move to the next deployment
                } else {
                    await placePodsAffinity(deployment.namespace, deployment.deploymentName, solarNode || "", true);
                    console.log(
                        `[${new Date().toISOString()}] Anti-affinity set for deployment "${deployment.deploymentName}" on node "${solarNode}" due to low battery (${nodeTrend.currentLevel}%).`
                    );
                }
            }
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during scheduled prioritization:`, error);
    }
}

// Schedule to run every minute
cron.schedule('* * * * *', prioritizeSolarNodesBasedOnBatteryTrends);
