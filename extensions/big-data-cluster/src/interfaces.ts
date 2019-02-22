/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface ClusterInfo {
	name: string;
	displayName: string;
	user: string;
}

export enum TargetClusterType {
	ExistingKubernetesCluster,
	NewAksCluster
}

export interface ClusterPorts {
	sql: string;
	knox: string;
	controller: string;
	proxy: string;
	grafana: string;
	kibana: string;
}

export interface ContainerRegistryInfo {
	registry: string;
	repository: string;
	imageTag: string;
}

export interface TargetClusterTypeInfo {
	type: TargetClusterType;
	name: string;
	iconPath: {
		dark: string,
		light: string
	};
	requiredTools: {
		name: string,
		description: string,
		isInstalled: boolean
	}[];
}