import { CoreV1Api, V1Node } from "@kubernetes/client-node";
import { k8sApi } from "./client";

export async function patchNodeLabel(node: V1Node, labelConfig: { [key: string]: string }) {
    const nodeName = node?.metadata?.name;
    const patchBody = {
        metadata: {
            labels: labelConfig,
        },
    };

    if (nodeName) {
        try {
            await k8sApi.patchNode(
                nodeName,
                patchBody,                       // Patch body
                undefined,                       // Subresource
                undefined,                       // Pretty print option
                undefined,                       // Dry-run option
                undefined,                       // FieldManager (Server-Side Apply)
                undefined,                       // Force option (only for apply patch)
                { headers: { "Content-Type": "application/strategic-merge-patch+json" } } // Headers
            );
            console.log(`Patched node ${nodeName} with labels ${JSON.stringify(labelConfig)}`);
        } catch (err) {
            console.error(`Error patching node ${nodeName}:`, err);
        }
    }
}

export async function setNodeLabels(labelsMapper: { [x: string]: { [key: string]: string; }; }) {
    try {
        const nodes = await k8sApi.listNode(); // Fetch all nodes
        await Promise.all(
            nodes.body.items.map(async (node) => {
                const nodeName = node?.metadata?.name || "";
                if (nodeName in labelsMapper && labelsMapper[nodeName]) {
                    await patchNodeLabel(node, labelsMapper[nodeName]);
                }
            })
        );
    } catch (err) {
        console.error("Error patching nodes:", err);
    }
}

export async function getAllNodesWithLabels() {
    try {
        const nodesResponse = await k8sApi.listNode();
        const nodes = nodesResponse.body.items.map(node => ({
            name: node.metadata?.name,
            labels: node.metadata?.labels
        }));
        return nodes;
    } catch (error) {
        console.error("Error fetching nodes:", error);
        throw error;
    }
}
