
// queryPrometheusRange();

import moment from "moment";
import { EnergyResponse } from "../types";

async function loadEnergyData() {
    const response = await fetch('https://api.electricitymap.org/v3/power-breakdown/history?zone=SK', {
        method: 'GET',
        headers: {
            'auth-token': '5fCA8R3VuUqhu8pcSdOy'
        }
    });
    const data = await response.json();
    return data as EnergyResponse;
}

async function loadAndSortEnergyData() {
    // Assume loadEnergyData() returns an array of energy data objects.
    const energyData = await loadEnergyData();

    energyData.history.sort((a: any, b: any) => {
        const hourA = moment(a.datetime).hours();
        const hourB = moment(b.datetime).hours();
        return hourA - hourB;
    });

    return energyData;
}

async function main() {
    const x = await loadAndSortEnergyData()
    console.log(x)
}

main()

