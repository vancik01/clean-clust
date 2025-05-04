# Carbon-Aware Temporal Workload Offloader

## Overview
This application implements a Kubernetes operator for Use Case 2: Temporal Workload Offloading. It schedules resource-intensive processing tasks during periods of low carbon intensity in the electrical grid, minimizing the environmental impact of computing operations.

## Features
- Analyzes carbon intensity data from Electricity Maps API ([documentation](https://portal.electricitymaps.com/docs/getting-started#geolocation)) to identify optimal low-carbon processing windows
- Dynamically scales Kubernetes deployments based on identified optimal periods
- Uses Kafka as a message queue to store incoming workloads during high-carbon periods
- Monitors queue size to prevent excessive backlogs during scaling decisions
- Stores historical data about optimal windows and scaling events

## How It Works
1. At midnight, the application fetches carbon intensity data for Slovakia from ElectricityMaps
2. It identifies optimal execution windows using a percentile-based approach
3. Throughout the day, it scales up task runner deployments during optimal windows
4. During high-carbon periods, it scales down task runners, allowing messages to queue in Kafka
5. It prevents excessive queue buildup by maintaining minimum processing capacity when backlogs grow

## Database
The application uses SQLite to store operational data in two tables:
- `optimal_windows`: Stores daily execution windows (date and JSON-formatted window data)
- `scaling_events`: Logs all scaling decisions with timestamps and deployment details

## Configuration
Configuration is defined in `config.ts`:
- `kubernetes`: Namespace and deployment settings, including min/max replica counts
- `kafka`: Connection details and topic configuration for the message queue
- `carbonIntensity`: Algorithm parameters for identifying optimal windows
    - `percentile`: Sets threshold for identifying "low carbon" hours (default: 30%)
    - `windowSize`: Minimum consecutive hours required to form a processing window
    - `maxWindows`: Maximum number of processing windows per day
- `database`: Path to SQLite database file
- `scheduling`: Operational parameters like queue size thresholds

## Core Functions
- `loadAndSortEnergyData()`: Fetches and processes carbon intensity data from Electricity Maps API
- `findOptimalExecutionWindows()`: Identifies the best time periods for processing based on carbon intensity
- `performHourlyScaling()`: Manages deployment scaling based on the current hour and queue status
- `scaleDeployment()`: Interfaces with Kubernetes API to adjust replica counts
- `getMessagesInQueue()`: Monitors Kafka consumer lag to prevent excessive backlogs
- `storeOptimalWindows()` & `logScalingEvent()`: Persist operational data to SQLite database

## Simulation Mode
The application simulates a 24-hour cycle in a 24 minutes, allowing for rapid testing and demonstration of the scheduling algorithm.