const express = require('express');
const client = require('prom-client');

// specify which node battery level are we simulating
client.register.setDefaultLabels({
    node: 'minikube-m02'
});

const app = express();

// Prometheus Metrics
const batteryLevelGauge = new client.Gauge({
    name: 'node_solar_battery_level',
    help: 'Simulated battery level percentage for a solar-powered node',
});

const solarInputGauge = new client.Gauge({
    name: 'node_solar_power_input_kw',
    help: 'Simulated solar power output from the PV array in kW',
});

const powerConsumptionGauge = new client.Gauge({
    name: 'node_solar_power_consumption_kw',
    help: 'Simulated constant power consumption of the node in kW',
});


const batteryCapacity = 1.8;
const fullLoadConsumption = 0.15; // kW - consumption when running full workloads
const idleConsumption = 0.03;    // kW - consumption when workloads are redirected (idle state)
let currentConsumption = fullLoadConsumption; // Start with full workload
const PV_nominal = 0.3;
let batteryEnergy = batteryCapacity * 0.85;
let workloadsRedirected = false;

// Battery thresholds
const lowBatteryThreshold = 20;
const resumeWorkloadThreshold = 30;

const mayIrradianceData = [
    0, 0, 0, 0, 11.142769739039789, 130.64209783591392, 233.04974371060143,
    309.280548889313, 367.8028779544398, 411.89600020124465, 427.7489315940487,
    421.243678546943, 417.8165459721911, 402.9242623084525, 375.72346476912344,
    341.3922465776532, 289.0777817170322, 227.03551188414076, 87.62911688195105,
    0, 0, 0, 0, 0
];

const maxIrradiance = Math.max(...mayIrradianceData);

const simulationCycleMinutes = 24; // 24 minutes for full 24-hour cycle
const updateInterval = 10000; // 10 seconds real time between updates - specified by Prometheus metrics collection cycle
const updatesPerCycle = (simulationCycleMinutes * 60 * 1000) / updateInterval; // Total updates in one cycle
const timeIncrement = 24 / updatesPerCycle; // How much time passes in each update

function getIrradiance(currentTime) {
    const hourIndex = Math.floor(currentTime) % 24;
    const nextHourIndex = (hourIndex + 1) % 24;

    const fraction = currentTime - Math.floor(currentTime);

    const currentHourIrradiance = mayIrradianceData[hourIndex];
    const nextHourIrradiance = mayIrradianceData[nextHourIndex];

    return currentHourIrradiance * (1 - fraction) + nextHourIrradiance * fraction;
}

function updateBatteryLevel(simulatedTime) {
    const irradiance = getIrradiance(simulatedTime);
    const pvPower = (irradiance / maxIrradiance) * PV_nominal; // kW

    const dt = timeIncrement;

    const pvEnergy = pvPower * dt;

    const batteryPercentage = (batteryEnergy / batteryCapacity) * 100;

    if (!workloadsRedirected && batteryPercentage < lowBatteryThreshold) {
        workloadsRedirected = true;
        currentConsumption = idleConsumption;
        console.log(`[ALERT] Battery level below ${lowBatteryThreshold}% - Workloads redirected, consumption reduced to ${idleConsumption * 1000}W`);
    }
    else if (workloadsRedirected && batteryPercentage > resumeWorkloadThreshold) {
        workloadsRedirected = false;
        currentConsumption = fullLoadConsumption;
        console.log(`[INFO] Battery level above ${resumeWorkloadThreshold}% - Workloads resumed, consumption back to ${fullLoadConsumption * 1000}W`);
    }

    const consumptionEnergy = currentConsumption * dt;

    const chargeEfficiency = 0.95;
    batteryEnergy = Math.max(0, Math.min(batteryCapacity, batteryEnergy + (pvEnergy * chargeEfficiency) - consumptionEnergy));

    // Update battery percentage after changes
    const updatedBatteryPercentage = (batteryEnergy / batteryCapacity) * 100;

    // logging
    console.log(
        `[Sim Time: ${simulatedTime.toFixed(2)}h] Irradiance: ${irradiance.toFixed(1)} W/m² | ` +
        `PV Power: ${pvPower.toFixed(3)} kW | ` +
        `PV Energy: ${pvEnergy.toFixed(4)} kWh | ` +
        `Consumption: ${currentConsumption.toFixed(3)} kW | ` +
        `Net Gain: ${(pvEnergy - consumptionEnergy).toFixed(4)} kWh | ` +
        `Battery: ${updatedBatteryPercentage.toFixed(2)}% | ` +
        `Workload State: ${workloadsRedirected ? "Redirected" : "Normal"} | ` +
        `Real Time: ${new Date().toLocaleTimeString()}`
    );

    // Prometheus metrics
    batteryLevelGauge.set(updatedBatteryPercentage);
    solarInputGauge.set(pvPower);
    powerConsumptionGauge.set(currentConsumption);
}

let simulatedTime = 18.0;

setInterval(() => {
    updateBatteryLevel(simulatedTime);
    simulatedTime += timeIncrement;

    if (simulatedTime >= 24) simulatedTime = 0;
}, updateInterval);

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("Simulation running...")
});