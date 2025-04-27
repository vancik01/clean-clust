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

    return [
        { hour: 0, value: 244 },
        { hour: 1, value: 219 },
        { hour: 2, value: 201 },
        { hour: 3, value: 198 },
        { hour: 4, value: 197 },
        { hour: 5, value: 196 },
        { hour: 6, value: 163 },
        { hour: 7, value: 140 },
        { hour: 8, value: 162 },
        { hour: 9, value: 176 },
        { hour: 10, value: 196 },
        { hour: 11, value: 195 },
        { hour: 12, value: 176 },
        { hour: 13, value: 167 },
        { hour: 14, value: 180 },
        { hour: 15, value: 191 },
        { hour: 16, value: 190 },
        { hour: 17, value: 214 },
        { hour: 18, value: 200 },
        { hour: 19, value: 180 },
        { hour: 20, value: 181 },
        { hour: 21, value: 194 },
        { hour: 22, value: 228 },
        { hour: 23, value: 221 }
    ];
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

    console.log(`Using threshold value of ${threshold} (${percentile}th percentile)`);

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

export { loadEnergyData, loadAndSortEnergyData, findOptimalExecutionWindows };