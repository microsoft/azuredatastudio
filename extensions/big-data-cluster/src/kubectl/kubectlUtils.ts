/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { Kubectl } from './kubectl';
import { failed, ClusterType } from '../interfaces';

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
    const shellResult = await kubectl.asJson<any>('config view -o json');
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
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig['current-context'])!;
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster)!;
    return {
        server: clusterConfig.cluster.server,
        certificateAuthority: clusterConfig.cluster['certificate-authority']
    };
}

export async function getContexts(kubectl: Kubectl): Promise<KubectlContext[]> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return [];
    }
    const currentContext = kubectlConfig['current-context'];
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

export async function setContext(kubectl: Kubectl, targetContext: string): Promise<void> {
    const shellResult = await kubectl.invokeAsync(`config use-context ${targetContext}`);
    if (!shellResult || shellResult.code !== 0) {
        // TODO: Update error handling for now.
        let errMsg = shellResult ? shellResult.stderr : localize('runKubectlFailed', 'Unable to run kubectl');
        vscode.window.showErrorMessage(localize('setClusterFailed', 'Failed to set \'${0}\' as current cluster: ${1}', targetContext, errMsg));
    }
}

export async function inferCurrentClusterType(kubectl: Kubectl): Promise<ClusterType> {
    let latestContextName = '';

    const ctxsr = await kubectl.invokeAsync('config current-context');
    if (ctxsr && ctxsr.code === 0) {
        latestContextName = ctxsr.stdout.trim();
    } else {
        return ClusterType.Other;
    }

    const cisr = await kubectl.invokeAsync('cluster-info');
    if (!cisr || cisr.code !== 0) {
        return ClusterType.Unknown;
    }
    const masterInfos = cisr.stdout.split('\n')
                                   .filter((s) => s.indexOf('master is running at') >= 0);

    if (masterInfos.length === 0) {
        return ClusterType.Other;
    }

    const masterInfo = masterInfos[0];
    if (masterInfo.indexOf('azmk8s.io') >= 0 || masterInfo.indexOf('azure.com') >= 0) {
        return ClusterType.AKS;
    }

    if (latestContextName) {
        const gcsr = await kubectl.invokeAsync(`config get-contexts ${latestContextName}`);
        if (gcsr && gcsr.code === 0) {
            if (gcsr.stdout.indexOf('minikube') >= 0) {
                return ClusterType.Minikube;
            }
        }
    }

    return ClusterType.Other;
}