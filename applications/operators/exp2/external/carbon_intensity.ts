import moment from "moment";
import { EnergyResponse } from "../types";

interface HourValue {
    hour: number;
    value: number;
}

interface Window {
    start: number;
    end: number;
    avgIntensity: number;
    length: number;
}

interface OptimalWindowOptions {
    percentile?: number;
    windowSize?: number;
    maxWindows?: number;
}

async function loadEnergyData(): Promise<EnergyResponse> {
    const response = await fetch('https://api.electricitymap.org/v3/carbon-intensity/history?zone=SK', {
        method: 'GET',
        headers: {
            'auth-token': process.env.ELECTRICITY_MAPS_AUTH_TOKEN || "5fCA8R3VuUqhu8pcSdOy"
        }
    });
    const data = await response.json();
    return data as EnergyResponse;
}

async function loadAndSortEnergyData(): Promise<HourValue[]> {
    const energyData = await loadEnergyData();

    // Sort by hour and extract only hour:value
    const hourValuePairs = energyData.history
        .map((entry: any) => ({
            hour: moment(entry.datetime).hour(),
            value: entry.carbonIntensity
        }))
        .sort((a, b) => a.hour - b.hour);

    return hourValuePairs
}

function findOptimalExecutionWindows(
    hourValueData: HourValue[],
    options: OptimalWindowOptions = {}
): Window[] {
    const {
        percentile = 30,
        windowSize = 1,
        maxWindows = 3
    } = options;

    const sortedByValue = [...hourValueData].sort((a, b) => a.value - b.value);

    // Calculate threshold based on percentile
    const thresholdIndex = Math.floor(sortedByValue.length * (percentile / 100));
    const threshold = sortedByValue[thresholdIndex].value;

    const goodHours = hourValueData
        .filter(item => item.value <= threshold)
        .map(item => item.hour);

    const windows: Window[] = [];
    let currentWindow: number[] = [];

    const hoursCycle = [...hourValueData.map(h => h.hour), 24];

    for (let i = 0; i < hoursCycle.length; i++) {
        const hour = hoursCycle[i] % 24;
        const isGoodHour = goodHours.includes(hour);

        if (isGoodHour) {
            currentWindow.push(hour);
        } else if (currentWindow.length > 0) {
            if (currentWindow.length >= windowSize) {
                // Calculate average intensity for this window
                const avgIntensity = calculateWindowIntensity(currentWindow, hourValueData);
                windows.push({
                    start: currentWindow[0],
                    end: currentWindow[currentWindow.length - 1],
                    avgIntensity,
                    length: currentWindow.length
                });
            }
            currentWindow = [];
        }
    }

    if (goodHours.includes(23) && goodHours.includes(0)) {
        const lastWindow = windows.find(w => w.end === 23);
        const firstWindow = windows.find(w => w.start === 0);

        if (lastWindow && firstWindow) {
            const mergedHours = [
                ...new Set([
                    ...(lastWindow.start.toString().split(',').map(Number)),
                    ...(firstWindow.end.toString().split(',').map(Number))
                ])
            ];
            const avgIntensity = calculateWindowIntensity(mergedHours, hourValueData);
            windows.push({
                start: lastWindow.start,
                end: firstWindow.end,
                avgIntensity,
                length: mergedHours.length
            });
        }
    }
    const sortedWindows = windows.sort((a, b) => a.avgIntensity - b.avgIntensity);
    return sortedWindows.slice(0, maxWindows);
}

function calculateWindowIntensity(hours: number[], hourValueData: HourValue[]): number {
    let total = 0;
    let count = 0;

    for (const hour of hours) {
        const data = hourValueData.find(item => item.hour === hour);
        if (data) {
            total += data.value;
            count++;
        }
    }

    return count > 0 ? Math.round(total / count) : 0;
}

export { loadAndSortEnergyData, findOptimalExecutionWindows };