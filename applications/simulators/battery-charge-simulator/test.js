const fs = require('fs');

// Parametre simulácie
const dt = 10 / 3600;               // časový krok 10 sekúnd v hodinách
const simulationDurationHours = 48; // simulácia na 48 hodín (2 dni)
const simulationSteps = (simulationDurationHours * 3600) / 10;

const batteryCapacity = 2;         // kWh – celková kapacita batérie
let batteryEnergy = batteryCapacity * 0.5;  // počiatočný stav batérie: 50% (5 kWh)
// Znížime spotrebu z 0,5 kW na 0,05 kW, aby bol výkon PV panelu (0,15 kW) dostatočný na dobíjanie batérie počas slnečných hodín
const consumptionRate = 0.07;       // kW – konštantná spotreba
const PV_nominal = 0.15;            // kW – nominálny výkon PV panelu pri 1000 W/m²
const maxIrradiance = 1000;         // W/m² – maximálne slnečné žiarenie

// Funkcia modelujúca slnečné žiarenie: sinusový priebeh medzi 6:00 a 18:00
function getIrradiance(currentTime) {
    if (currentTime >= 6 && currentTime <= 18) {
        return maxIrradiance * Math.sin(Math.PI * (currentTime - 6) / 12);
    }
    return 0;
}

// Príprava CSV súboru
const outputFile = 'simulation.csv';
const header = "Time (h)\tIrradiance (W/m²)\tPV Power (kW)\tPV Energy (kWh)\tConsumption (kWh)\tBattery (%)\n";
fs.writeFileSync(outputFile, header);

// Funkcia simulácie
function runSimulation() {
    let simulationTime = 0; // simulovaný čas v hodinách

    for (let i = 0; i < simulationSteps; i++) {
        let currentHourOfDay = simulationTime % 24;
        let irradiance = getIrradiance(currentHourOfDay);
        let pvPower = (irradiance / maxIrradiance) * PV_nominal; // kW
        let pvEnergy = pvPower * dt;       // kWh získané z PV počas intervalu
        let consumptionEnergy = consumptionRate * dt; // kWh spotrebované počas intervalu

        // Aktualizácia stavu batérie
        batteryEnergy = Math.max(0, Math.min(batteryCapacity, batteryEnergy + pvEnergy - consumptionEnergy));
        let batteryPercentage = (batteryEnergy / batteryCapacity) * 100;

        // Zostavenie CSV riadku
        let line = [
            simulationTime.toFixed(2),
            irradiance.toFixed(0),
            pvPower.toFixed(3),
            pvEnergy.toFixed(4),
            consumptionEnergy.toFixed(4),
            batteryPercentage.toFixed(2)
        ].join("\t").replaceAll(".", ",") + "\n";

        // Zápis do CSV súboru
        fs.appendFileSync(outputFile, line);

        simulationTime += dt;
    }

    console.log(`Simulácia dokončená. Výsledky boli zapísané do ${outputFile}`);
}

runSimulation();
