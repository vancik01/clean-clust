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

// Configuration
const batteryCapacity = 1.5; // kWh - total battery capacity
const consumptionRate = 0.08; // kW - constant power consumption (80W)
const PV_nominal = 0.3; // kW - solar input (300W max)
let batteryEnergy = batteryCapacity * 0.2; // Start at 20% battery at 6:00 AM
const maxIrradiance = 1000; // Max solar radiation in W/m²

// Simulation Configuration
const realDuration = 60 * 60 * 1000; // 1 hour in real time
const simulatedDuration = 24; // 24-hour simulated time
const updateInterval = 10000; // updates battery every 10 seconds in real-time
const timeMultiplier = simulatedDuration / (realDuration / updateInterval); // correct scaling factor


// simulate solar irradiance based on a sinusoidal 24h model
function getIrradiance(currentTime) {
    if (currentTime >= 6 && currentTime <= 18) {
        return maxIrradiance * Math.sin(Math.PI * (currentTime - 6) / 12);
    }
    return 0;
}

// Function to update battery level dynamically
function updateBatteryLevel(simulatedTime) {
    const irradiance = getIrradiance(simulatedTime);
    const pvPower = (irradiance / maxIrradiance) * PV_nominal; // kW

    const dt = (updateInterval / 3600000) * simulatedDuration;

    const pvEnergy = pvPower * dt;
    const consumptionEnergy = consumptionRate * dt;

    // charge efficiency (95%)
    const chargeEfficiency = 0.95;
    batteryEnergy = Math.max(0, Math.min(batteryCapacity, batteryEnergy + (pvEnergy * chargeEfficiency) - consumptionEnergy));
    const batteryPercentage = (batteryEnergy / batteryCapacity) * 100;

    // logging
    console.log(
        `[Sim Time: ${simulatedTime.toFixed(2)}h] Irradiance: ${irradiance.toFixed(0)} W/m² | ` +
        `PV Power: ${pvPower.toFixed(3)} kW | ` +
        `PV Energy: ${pvEnergy.toFixed(4)} kWh | ` +
        `Net Gain: ${(pvEnergy - consumptionEnergy).toFixed(4)} kWh | ` +
        `Battery: ${batteryPercentage.toFixed(2)}%`
    );

    // Prometheus metrics
    batteryLevelGauge.set(batteryPercentage);
    solarInputGauge.set(pvPower);
    powerConsumptionGauge.set(consumptionRate);
}

// Start simulation from 6:00 AM
let simulatedTime = 6.0;

// Simulation Loop (Simulates 24h in 1h real time)
setInterval(() => {
    updateBatteryLevel(simulatedTime);
    simulatedTime += timeMultiplier;

    if (simulatedTime >= 30) simulatedTime = 6; // Reset after 24h cycle
}, updateInterval);


app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Solar Battery Simulator running on port ${PORT}, metrics available at /metrics`);
});
