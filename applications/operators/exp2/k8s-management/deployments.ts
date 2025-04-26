import { V1Pod } from "@kubernetes/client-node";
import { k8sApi, k8sAppsApi } from "./client";
import { config } from "../config";

export async function placePodsAffinity(
    namespace: string,
    deploymentName: string,
    node: string,
    antiAffinity: boolean = false,
    nodeSelectorName: string,
) {
    try {
        const deploymentResp = await k8sAppsApi.readNamespacedDeployment(deploymentName, namespace);
        const existingAffinity = deploymentResp.body.spec?.template?.spec?.affinity;

        const existingNodeAffinity = existingAffinity?.nodeAffinity;
        const isAlreadySet = antiAffinity
            ? existingNodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms.some(term =>
                term.matchExpressions?.some(expr =>
                    expr.key === 'kubernetes.io/hostname' &&
                    expr.operator === 'NotIn' &&
                    expr?.values?.includes(node)
                )
            )
            : existingNodeAffinity?.preferredDuringSchedulingIgnoredDuringExecution?.some(pref =>
                pref?.preference?.matchExpressions?.some(expr =>
                    expr.key === nodeSelectorName &&
                    expr.operator === 'In' &&
                    expr?.values?.includes(node)
                )
            );

        if (isAlreadySet) {
            console.log(`Deployment "${deploymentName}" already has the desired affinity set for node "${node}". Skipping update.`);
            return;
        }

        if (existingAffinity) {
            resetDeploymentAffinity(namespace, deploymentName)
        }

        const patchBody = {
            spec: {
                template: {
                    metadata: {
                        annotations: {
                            'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                        },
                    },
                    spec: {
                        affinity: {
                            nodeAffinity: antiAffinity
                                ? {
                                    requiredDuringSchedulingIgnoredDuringExecution: {
                                        nodeSelectorTerms: [
                                            {
                                                matchExpressions: [
                                                    {
                                                        key: 'kubernetes.io/hostname',
                                                        operator: 'NotIn',
                                                        values: [node],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                }
                                : {
                                    preferredDuringSchedulingIgnoredDuringExecution: [
                                        {
                                            weight: 1,
                                            preference: {
                                                matchExpressions: [
                                                    {
                                                        key: nodeSelectorName,
                                                        operator: 'In',
                                                        values: [node],
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                    requiredDuringSchedulingIgnoredDuringExecution: null,
                                },
                        },
                    },
                },
            },
        };

        await k8sAppsApi.patchNamespacedDeployment(
            deploymentName,
            namespace,
            patchBody,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
        );

        console.log(
            `Deployment "${deploymentName}" affinity updated. Now ${antiAffinity ? 'avoiding' : 'prioritizing'} node "${node}".`
        );
    } catch (err) {
        console.error(`Error updating affinity for deployment "${deploymentName}":`, err);
    }
}


export async function getDeploymentNameForPod(namespace: string, pod: V1Pod): Promise<string | null> {
    const ownerRefs = pod.metadata?.ownerReferences;
    if (!ownerRefs || ownerRefs.length === 0) {
        return null;
    }

    const replicaSetRef = ownerRefs.find(ref => ref.kind === 'ReplicaSet');
    if (!replicaSetRef) {
        return null;
    }

    try {
        const rsResponse = await k8sAppsApi.readNamespacedReplicaSet(replicaSetRef.name, namespace);
        const replicaSet = rsResponse.body;
        const rsOwnerRefs = replicaSet.metadata?.ownerReferences;

        if (rsOwnerRefs) {
            const deploymentRef = rsOwnerRefs.find(ref => ref.kind === 'Deployment');
            if (deploymentRef) {
                return deploymentRef.name;
            }
        }
    } catch (err) {
        console.error(`Error retrieving ReplicaSet ${replicaSetRef.name}:`, err);
    }

    return null;
}

export async function printPodDeploymentNames(namespace: string) {
    try {
        const podsResponse = await k8sApi.listNamespacedPod(namespace);
        const pods = podsResponse.body.items;
        await Promise.all(
            pods.map(async pod => {
                const deploymentName = await getDeploymentNameForPod(namespace, pod);
                console.log(`Pod ${pod.metadata?.name} is owned by Deployment: ${deploymentName}`);
            })
        );
    } catch (err) {
        console.error("Error listing pods:", err);
    }
}

export async function resetDeploymentAffinity(namespace: string,
    deploymentName: string
) {
    const clearAffinityPatch = {
        spec: {
            template: {
                spec: {
                    affinity: null
                },
            },
        },
    };

    await k8sAppsApi.patchNamespacedDeployment(
        deploymentName,
        namespace,
        clearAffinityPatch,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
    );

    console.log(`Cleared existing affinity for deployment "${deploymentName}" before applying new one.`);
}

interface DeploymentInfo {
    namespace: string;
    deploymentName: string;
    podCount: number;
}

export async function getActiveDeployments(namespacesToScan: string[]): Promise<DeploymentInfo[]> {
    const activeDeployments: DeploymentInfo[] = [];

    try {
        for (const namespace of namespacesToScan) {
            const deploymentsResp = await k8sAppsApi.listNamespacedDeployment(namespace);
            const deployments = deploymentsResp.body.items;

            for (const deployment of deployments) {
                const selector = deployment.spec?.selector?.matchLabels;
                if (!selector) continue;

                const selectorQuery = Object.entries(selector)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(',');

                const podsResp = await k8sApi.listNamespacedPod(
                    namespace,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    selectorQuery
                );

                const activePodCount = podsResp.body.items.filter(
                    pod => pod.status?.phase === 'Running'
                ).length;

                if (activePodCount > 0) {
                    activeDeployments.push({
                        namespace,
                        deploymentName: deployment.metadata?.name!,
                        podCount: activePodCount
                    });
                }
            }
        }

        return activeDeployments;
    } catch (error) {
        console.error("Error fetching active deployments:", error);
        throw error;
    }
}

export async function scaleDeployment(deploymentName: string, namespace: string, desiredReplicas: number) {
    try {
        const res = await k8sAppsApi.readNamespacedDeployment(deploymentName, namespace);
        const deployment = res.body;

        deployment.spec!.replicas = desiredReplicas;

        await k8sAppsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment);

        console.log(`✅ Scaled ${deploymentName} to ${desiredReplicas} replicas`);
    } catch (err) {
        console.error(`❌ Failed to scale deployment:`, err);
    }
}
