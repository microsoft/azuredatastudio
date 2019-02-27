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

export interface Succeeded<T> {
	readonly succeeded: true;
	readonly result: T;
}

export interface Failed {
	readonly succeeded: false;
	readonly error: string[];
}

export type Errorable<T> = Succeeded<T> | Failed;

export function succeeded<T>(e: Errorable<T>): e is Succeeded<T> {
	return e.succeeded;
}

export function failed<T>(e: Errorable<T>): e is Failed {
	return !e.succeeded;
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
}

export interface ToolInfo {
	name: string;
	description: string;
	status: ToolInstallationStatus;
}

export enum ToolInstallationStatus {
	Installed,
	NotInstalled,
	Installing
}
