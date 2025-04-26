export const config = {
    nodeSelectorName: "kubernetes.io/hostname",
    applyForNamespaces: ["testing"],
    monitoring: {
        prometheusUrl: "http://monitoring-kube-prometheus-prometheus.monitoring:9090/",
        inClusterUrl: ""
    },
    rescheduling: {
        batteryLevelTreshold: 20 // battery % to 
    }
}

