const express = require('express');
const client = require('prom-client');

// Set a default label so that every metric includes the static node name
client.register.setDefaultLabels({
    node: 'minikube-m02'
});

// Create an Express app to expose metrics
const app = express();

// Prometheus Metric: Battery Level (as percentage)
const batteryLevelGauge = new client.Gauge({
    name: 'node_solar_battery_level',
    help: 'Simulated battery level percentage for a solar-powered node',
});

// Prometheus Metric: Solar Power Input (kW) – instantaneous PV output
const solarInputGauge = new client.Gauge({
    name: 'node_solar_power_input_kw',
    help: 'Simulated solar power output from the PV array in kW',
});

// Prometheus Metric: Power Consumption (kW)
const powerConsumptionGauge = new client.Gauge({
    name: 'node_solar_power_consumption_kw',
    help: 'Simulated constant power consumption of the node in kW',
});

// Battery and PV Configuration
const batteryCapacity = 2;         // kWh – celková kapacita batérie
let batteryEnergy = batteryCapacity * 0.5;  // počiatočný stav batérie: 50% (5 kWh)
// Znížime spotrebu z 0,5 kW na 0,05 kW, aby bol výkon PV panelu (0,15 kW) dostatočný na dobíjanie batérie počas slnečných hodín
const consumptionRate = 0.07;       // kW – konštantná spotreba
const PV_nominal = 0.15;            // kW – nominálny výkon PV panelu pri 1000 W/m²
const maxIrradiance = 1000;

// Time delta: 10 seconds expressed in hours (10 sec = 10/3600 hours)
const dt = 10 / 3600;

// Function to compute irradiance (W/m²) using a sinusoidal model between 6 and 18 hours
function getIrradiance(currentTime) {
    // currentTime in decimal hours (e.g., 13.75 for 1:45 PM)
    if (currentTime >= 6 && currentTime <= 18) {
        // Sinusoidal profile: max at noon (12:00), zero at 6:00 and 18:00.
        // Scale: irradiance = maxIrradiance * sin(pi*(currentTime - 6)/12)
        return maxIrradiance * Math.sin(Math.PI * (currentTime - 6) / 12);
    }
    return 0;
}

// Function to update battery charge based on academic paper approach
function updateBatteryLevel() {
    // Based on: https://ieeexplore.ieee.org/abstract/document/7005999
    const now = new Date();
    const currentTime = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    // Compute current irradiance (W/m²)
    const irradiance = getIrradiance(currentTime);

    // Compute PV array maximum power output using a linear model:
    // At max irradiance (1000 W/m²), output = PV_nominal (0.15 kW).
    // At lower irradiance, output scales linearly.
    const pvPower = (irradiance / maxIrradiance) * PV_nominal; // in kW

    // Energy produced in this 10-sec interval (in kWh)
    const pvEnergy = pvPower * dt;

    // Energy consumed during this interval (in kWh)
    const consumptionEnergy = consumptionRate * dt;

    // Update battery energy (in kWh) and ensure it stays between 0 and batteryCapacity.
    batteryEnergy = Math.max(0, Math.min(batteryCapacity, batteryEnergy + pvEnergy - consumptionEnergy));

    // Compute battery level as a percentage.
    const batteryPercentage = (batteryEnergy / batteryCapacity) * 100;

    // Log simulation data
    console.log(
        `[${now.toISOString()}] Irradiance: ${irradiance.toFixed(0)} W/m² | ` +
        `PV Power: ${pvPower.toFixed(3)} kW | PV Energy: ${pvEnergy.toFixed(4)} kWh | ` +
        `Consumption: ${consumptionRate.toFixed(2)} kW | ` +
        `Battery: ${batteryPercentage.toFixed(2)}%`
    );

    // Update Prometheus metrics
    batteryLevelGauge.set(batteryPercentage);
    solarInputGauge.set(pvPower);
    powerConsumptionGauge.set(consumptionRate);
}

// Run the simulation every 10 seconds
setInterval(updateBatteryLevel, 10000);
// Run an initial update immediately
updateBatteryLevel();

// Expose the /metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

// Start the Express server on port 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Solar Battery Simulator running on port ${PORT}, metrics available at /metrics`);
});
