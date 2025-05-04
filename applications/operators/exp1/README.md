# Solar-Aware Kubernetes Operator

## Overview
This application implements a Kubernetes operator for Use Case 1: Scheduling with Renewable Energy Awareness. It dynamically prioritizes workload placement on solar-powered nodes based on real-time battery levels and charging trends.

## Features
- Automatically identifies nodes labeled with `power=solar` in the Kubernetes cluster
- Monitors battery levels and charging trends of solar-powered nodes
- Dynamically adjusts scheduling decisions based on battery thresholds
- Applies node affinity rules to direct workloads toward or away from solar nodes
- Uses adaptive thresholds that consider whether battery levels are rising or falling
- Runs on a configurable schedule (default: every minute)

## How It Works
1. The operator identifies solar-powered nodes in the cluster
2. It fetches current battery levels and determines if levels are rising or falling 
3. It adjusts thresholds based on battery trends (lower threshold for falling batteries, higher for rising)
4. For each deployment in monitored namespaces:
  - If battery level is above threshold: Applies affinity rules to prioritize the solar node
  - If battery level is below threshold: Applies anti-affinity rules to direct workloads away

## Prerequisites
- At least one node inside the cluster is tagged with label `power=solar`
- The `battery-charge-simulator` is deployed to provide battery metrics
- Prometheus monitoring stack is configured to collect battery level metrics for the same node that was tagged with `power=solar` label

## Configuration
Configuration is defined in `config.ts` file:
- `nodeSelectorName`: The node label to use for selection based on the name (default: "kubernetes.io/hostname")
- `applyForNamespaces`: Array of namespaces to monitor and apply strategy (default: ["testing"])
- `monitoring.prometheusUrl`: URL of prometheus service inside the cluster
- `rescheduling`: 
    - `BASE_THRESHOLD`: Default battery percentage threshold (30%)
    - `THRESHOLD_OFFSET`: Adjustment applied based on battery trend (±5%)

## Core functions
- `fetchBatteryLevelsAndTrends()`: Fetches battery metrics from Prometheus and determines if levels are rising, falling, or stable based on 5-minute historical data
- `placePodsAffinity()`: Modifies deployment specifications to add node affinity or anti-affinity rules, directing pods toward or away from specific nodes. 