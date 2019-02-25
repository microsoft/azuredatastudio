/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Kubectl } from "./kubectl";
import { failed } from "../interfaces";

export interface KubectlContext {
    readonly clusterName: string;
    readonly contextName: string;
    readonly userName: string;
    readonly active: boolean;
}

interface Kubeconfig {
    readonly apiVersion: string;
    readonly 'current-context': string;
    readonly clusters: {
        readonly name: string;
        readonly cluster: {
            readonly server: string;
            readonly 'certificate-authority'?: string;
            readonly 'certificate-authority-data'?: string;
        };
    }[] | undefined;
    readonly contexts: {
        readonly name: string;
        readonly context: {
            readonly cluster: string;
            readonly user: string;
            readonly namespace?: string;
        };
    }[] | undefined;
    readonly users: {
        readonly name: string;
        readonly user: {};
    }[] | undefined;
}

export interface ClusterConfig {
    readonly server: string;
    readonly certificateAuthority: string | undefined;
}



async function getKubeconfig(kubectl: Kubectl): Promise<Kubeconfig | null> {
    const shellResult = await kubectl.asJson<any>("config view -o json");
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return null;
    }
    return shellResult.result;
}

export async function getCurrentClusterConfig(kubectl: Kubectl): Promise<ClusterConfig | undefined> {
    const kubeConfig = await getKubeconfig(kubectl);
    if (!kubeConfig || !kubeConfig.clusters || !kubeConfig.contexts) {
        return undefined;
    }
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig["current-context"])!;
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster)!;
    return {
        server: clusterConfig.cluster.server,
        certificateAuthority: clusterConfig.cluster["certificate-authority"]
    };
}

export async function getContexts(kubectl: Kubectl): Promise<KubectlContext[]> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return [];
    }
    const currentContext = kubectlConfig["current-context"];
    const contexts = kubectlConfig.contexts || [];
    return contexts.map((c) => {
        return {
            clusterName: c.context.cluster,
            contextName: c.name,
            userName: c.context.user,
            active: c.name === currentContext
        };
    });
}