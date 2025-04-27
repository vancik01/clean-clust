"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scaleDeployment = exports.getActiveDeployments = exports.resetDeploymentAffinity = exports.printPodDeploymentNames = exports.getDeploymentNameForPod = exports.placePodsAffinity = void 0;
var client_1 = require("./client");
function placePodsAffinity(namespace, deploymentName, node, antiAffinity, nodeSelectorName) {
    var _a, _b, _c, _d, _e;
    if (antiAffinity === void 0) { antiAffinity = false; }
    return __awaiter(this, void 0, void 0, function () {
        var deploymentResp, existingAffinity, existingNodeAffinity, isAlreadySet, patchBody, err_1;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, client_1.k8sAppsApi.readNamespacedDeployment(deploymentName, namespace)];
                case 1:
                    deploymentResp = _f.sent();
                    existingAffinity = (_c = (_b = (_a = deploymentResp.body.spec) === null || _a === void 0 ? void 0 : _a.template) === null || _b === void 0 ? void 0 : _b.spec) === null || _c === void 0 ? void 0 : _c.affinity;
                    existingNodeAffinity = existingAffinity === null || existingAffinity === void 0 ? void 0 : existingAffinity.nodeAffinity;
                    isAlreadySet = antiAffinity
                        ? (_d = existingNodeAffinity === null || existingNodeAffinity === void 0 ? void 0 : existingNodeAffinity.requiredDuringSchedulingIgnoredDuringExecution) === null || _d === void 0 ? void 0 : _d.nodeSelectorTerms.some(function (term) {
                            var _a;
                            return (_a = term.matchExpressions) === null || _a === void 0 ? void 0 : _a.some(function (expr) {
                                var _a;
                                return expr.key === 'kubernetes.io/hostname' &&
                                    expr.operator === 'NotIn' &&
                                    ((_a = expr === null || expr === void 0 ? void 0 : expr.values) === null || _a === void 0 ? void 0 : _a.includes(node));
                            });
                        })
                        : (_e = existingNodeAffinity === null || existingNodeAffinity === void 0 ? void 0 : existingNodeAffinity.preferredDuringSchedulingIgnoredDuringExecution) === null || _e === void 0 ? void 0 : _e.some(function (pref) {
                            var _a, _b;
                            return (_b = (_a = pref === null || pref === void 0 ? void 0 : pref.preference) === null || _a === void 0 ? void 0 : _a.matchExpressions) === null || _b === void 0 ? void 0 : _b.some(function (expr) {
                                var _a;
                                return expr.key === nodeSelectorName &&
                                    expr.operator === 'In' &&
                                    ((_a = expr === null || expr === void 0 ? void 0 : expr.values) === null || _a === void 0 ? void 0 : _a.includes(node));
                            });
                        });
                    if (isAlreadySet) {
                        console.log("Deployment \"".concat(deploymentName, "\" already has the desired affinity set for node \"").concat(node, "\". Skipping update."));
                        return [2 /*return*/];
                    }
                    if (existingAffinity) {
                        resetDeploymentAffinity(namespace, deploymentName);
                    }
                    patchBody = {
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
                    return [4 /*yield*/, client_1.k8sAppsApi.patchNamespacedDeployment(deploymentName, namespace, patchBody, undefined, undefined, undefined, undefined, undefined, { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } })];
                case 2:
                    _f.sent();
                    console.log("Deployment \"".concat(deploymentName, "\" affinity updated. Now ").concat(antiAffinity ? 'avoiding' : 'prioritizing', " node \"").concat(node, "\"."));
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _f.sent();
                    console.error("Error updating affinity for deployment \"".concat(deploymentName, "\":"), err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.placePodsAffinity = placePodsAffinity;
function getDeploymentNameForPod(namespace, pod) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var ownerRefs, replicaSetRef, rsResponse, replicaSet, rsOwnerRefs, deploymentRef, err_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ownerRefs = (_a = pod.metadata) === null || _a === void 0 ? void 0 : _a.ownerReferences;
                    if (!ownerRefs || ownerRefs.length === 0) {
                        return [2 /*return*/, null];
                    }
                    replicaSetRef = ownerRefs.find(function (ref) { return ref.kind === 'ReplicaSet'; });
                    if (!replicaSetRef) {
                        return [2 /*return*/, null];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client_1.k8sAppsApi.readNamespacedReplicaSet(replicaSetRef.name, namespace)];
                case 2:
                    rsResponse = _c.sent();
                    replicaSet = rsResponse.body;
                    rsOwnerRefs = (_b = replicaSet.metadata) === null || _b === void 0 ? void 0 : _b.ownerReferences;
                    if (rsOwnerRefs) {
                        deploymentRef = rsOwnerRefs.find(function (ref) { return ref.kind === 'Deployment'; });
                        if (deploymentRef) {
                            return [2 /*return*/, deploymentRef.name];
                        }
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    console.error("Error retrieving ReplicaSet ".concat(replicaSetRef.name, ":"), err_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, null];
            }
        });
    });
}
exports.getDeploymentNameForPod = getDeploymentNameForPod;
function printPodDeploymentNames(namespace) {
    return __awaiter(this, void 0, void 0, function () {
        var podsResponse, pods, err_3;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, client_1.k8sApi.listNamespacedPod(namespace)];
                case 1:
                    podsResponse = _a.sent();
                    pods = podsResponse.body.items;
                    return [4 /*yield*/, Promise.all(pods.map(function (pod) { return __awaiter(_this, void 0, void 0, function () {
                            var deploymentName;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, getDeploymentNameForPod(namespace, pod)];
                                    case 1:
                                        deploymentName = _b.sent();
                                        console.log("Pod ".concat((_a = pod.metadata) === null || _a === void 0 ? void 0 : _a.name, " is owned by Deployment: ").concat(deploymentName));
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _a.sent();
                    console.error("Error listing pods:", err_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.printPodDeploymentNames = printPodDeploymentNames;
function resetDeploymentAffinity(namespace, deploymentName) {
    return __awaiter(this, void 0, void 0, function () {
        var clearAffinityPatch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clearAffinityPatch = {
                        spec: {
                            template: {
                                spec: {
                                    affinity: null
                                },
                            },
                        },
                    };
                    return [4 /*yield*/, client_1.k8sAppsApi.patchNamespacedDeployment(deploymentName, namespace, clearAffinityPatch, undefined, undefined, undefined, undefined, undefined, { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } })];
                case 1:
                    _a.sent();
                    console.log("Cleared existing affinity for deployment \"".concat(deploymentName, "\" before applying new one."));
                    return [2 /*return*/];
            }
        });
    });
}
exports.resetDeploymentAffinity = resetDeploymentAffinity;
function getActiveDeployments(namespacesToScan) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var activeDeployments, _i, namespacesToScan_1, namespace, deploymentsResp, deployments, _d, deployments_1, deployment, selector, selectorQuery, podsResp, activePodCount, error_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    activeDeployments = [];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 9, , 10]);
                    _i = 0, namespacesToScan_1 = namespacesToScan;
                    _e.label = 2;
                case 2:
                    if (!(_i < namespacesToScan_1.length)) return [3 /*break*/, 8];
                    namespace = namespacesToScan_1[_i];
                    return [4 /*yield*/, client_1.k8sAppsApi.listNamespacedDeployment(namespace)];
                case 3:
                    deploymentsResp = _e.sent();
                    deployments = deploymentsResp.body.items;
                    _d = 0, deployments_1 = deployments;
                    _e.label = 4;
                case 4:
                    if (!(_d < deployments_1.length)) return [3 /*break*/, 7];
                    deployment = deployments_1[_d];
                    selector = (_b = (_a = deployment.spec) === null || _a === void 0 ? void 0 : _a.selector) === null || _b === void 0 ? void 0 : _b.matchLabels;
                    if (!selector)
                        return [3 /*break*/, 6];
                    selectorQuery = Object.entries(selector)
                        .map(function (_a) {
                        var key = _a[0], value = _a[1];
                        return "".concat(key, "=").concat(value);
                    })
                        .join(',');
                    return [4 /*yield*/, client_1.k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, selectorQuery)];
                case 5:
                    podsResp = _e.sent();
                    activePodCount = podsResp.body.items.filter(function (pod) { var _a; return ((_a = pod.status) === null || _a === void 0 ? void 0 : _a.phase) === 'Running'; }).length;
                    if (activePodCount > 0) {
                        activeDeployments.push({
                            namespace: namespace,
                            deploymentName: (_c = deployment.metadata) === null || _c === void 0 ? void 0 : _c.name,
                            podCount: activePodCount
                        });
                    }
                    _e.label = 6;
                case 6:
                    _d++;
                    return [3 /*break*/, 4];
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/, activeDeployments];
                case 9:
                    error_1 = _e.sent();
                    console.error("Error fetching active deployments:", error_1);
                    throw error_1;
                case 10: return [2 /*return*/];
            }
        });
    });
}
exports.getActiveDeployments = getActiveDeployments;
function scaleDeployment(deploymentName, namespace, desiredReplicas) {
    return __awaiter(this, void 0, void 0, function () {
        var res, deployment, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, client_1.k8sAppsApi.readNamespacedDeployment(deploymentName, namespace)];
                case 1:
                    res = _a.sent();
                    deployment = res.body;
                    deployment.spec.replicas = desiredReplicas;
                    return [4 /*yield*/, client_1.k8sAppsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment)];
                case 2:
                    _a.sent();
                    console.log("\u2705 Scaled ".concat(deploymentName, " to ").concat(desiredReplicas, " replicas"));
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _a.sent();
                    console.error("\u274C Failed to scale deployment:", err_4);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.scaleDeployment = scaleDeployment;
