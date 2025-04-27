export type EnergyResponse = {
    zone: "SK";
    history: History[];
}

export type PowerBreakdown = {
    nuclear: number;
    geothermal: null;
    biomass: number;
    coal: number;
    wind: number;
    solar: number;
    hydro: number;
    gas: number;
    oil: number;
    unknown: number;
}

export type History = {
    zone: "SK";
    datetime: string;
    updatedAt: string;
    createdAt: string;
    powerConsumptionBreakdown: PowerBreakdown;
    powerProductionBreakdown: PowerBreakdown;
    powerImportBreakdown: PowerPortBreakdown;
    powerExportBreakdown: PowerPortBreakdown;
    fossilFreePercentage: number;
    renewablePercentage: number;
    powerConsumptionTotal: number;
    powerProductionTotal: number;
    powerImportTotal: number;
    powerExportTotal: number;
    isEstimated: boolean;
    estimationMethod: null | string;
}

export type PowerPortBreakdown = {
    cz: number;
    hu: number;
    pl: number;
    ua: number;
}

export interface Window {
    start: number;
    end: number;
    avgIntensity: number;
    length: number;
}

export interface DailyWindows {
    date: string;
    windows: Window[];
}

export interface ScalingEvent {
    id?: number;
    timestamp: string;
    hour: number;
    deploymentName: string;
    namespace: string;
    targetReplicas: number;
    reason: string;
}
