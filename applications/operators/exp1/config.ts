export const config = {
    nodeSelectorName: "kubernetes.io/hostname",
    applyForNamespaces: ["testing"],
    monitoring: {
        prometheusUrl: "http://monitoring-kube-prometheus-prometheus.monitoring:9090/",
    },
    rescheduling: {
        BASE_THRESHOLD: 30,
        THRESHOLD_OFFSET: 5
    }
}

