"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.k8sAppsApi = exports.k8sApi = void 0;
var k8s = require("@kubernetes/client-node");
var kc = new k8s.KubeConfig();
kc.loadFromDefault();
exports.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
exports.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
