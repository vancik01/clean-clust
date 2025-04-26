import { k8sApi } from "./client";

export async function patchPodAffinity(namespace: string, podName: string, planTo: string) {
    const nodeNameLabel = "topology.hostpath.csi/node";
    const patchBody = {
        spec: {
            affinity: {
                nodeAffinity: {
                    requiredDuringSchedulingIgnoredDuringExecution: {
                        nodeSelectorTerms: [
                            {
                                matchExpressions: [
                                    {
                                        key: nodeNameLabel,
                                        operator: "In",
                                        values: [planTo],
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        },
    };

    try {
        console.log(`Patching pod ${podName} in namespace ${namespace}...`);
        const res = await k8sApi.patchNamespacedPod(
            podName,
            namespace,
            patchBody,
            undefined, // Pretty print option
            undefined, // Dry-run option
            undefined, // Field Manager
            undefined, // Force option
            undefined,
            { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
        );
        console.log(`Pod ${podName} patched successfully. New affinity:`, res?.body?.spec?.affinity);
    } catch (err) {
        console.error(`Error patching pod ${podName}:`, err);
    }
}

export async function evictPod(namespace: string, podName: string) {
    const eviction = {
        apiVersion: "policy/v1",
        kind: "Eviction",
        metadata: {
            name: podName,
            namespace: namespace,
        },
    };

    try {
        await k8sApi.createNamespacedPodEviction(podName, namespace, eviction);
        console.log(`Evicted pod ${podName} successfully.`);
    } catch (err) {
        console.error(`Error evicting pod ${podName}:`, err);
    }
}