// main-simulated.ts
import moment from 'moment';
import { config } from './config';
import {
    initDatabase,
    storeOptimalWindows,
    getOptimalWindows,
    logScalingEvent,
    closeDatabase,
} from './database';
import { findOptimalExecutionWindows, loadAndSortEnergyData } from './external/carbon_intensity';
import { getMessagesInQueue } from './external/kafka';
import { scaleDeployment } from './k8s-management/deployments';
import { Window } from './types';

async function main() {
    const d = await loadAndSortEnergyData()
    console.log(d.map((x) => x.hour + ", " + x.value).join("\n"))
}

main()

