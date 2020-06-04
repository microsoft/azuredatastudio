/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as constants from './constants';
const localize = nls.loadMessageBundle();

export enum Endpoint {
	gateway = 'gateway',
	sparkHistory = 'spark-history',
	yarnUi = 'yarn-ui',
	appProxy = 'app-proxy',
	mgmtproxy = 'mgmtproxy',
	managementProxy = 'management-proxy',
	logsui = 'logsui',
	metricsui = 'metricsui',
	controller = 'controller',
	sqlServerMaster = 'sql-server-master',
	webhdfs = 'webhdfs',
	livy = 'livy'
}

export enum Service {
	sql = 'sql',
	hdfs = 'hdfs',
	spark = 'spark',
	control = 'control',
	gateway = 'gateway',
	app = 'app'
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	let oct: string = '';
	let tmp: number;
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
}

export function showErrorMessage(error: any, prefixText?: string): void {
	if (error) {
		let text: string = prefixText || '';
		if (typeof error === 'string') {
			text += error as string;
		} else if (typeof error === 'object' && error !== null) {
			text += error.message;
			if (error.code && error.code > 0) {
				text += ` (${error.code})`;
			}
		} else {
			text += `${error}`;
		}
		vscode.window.showErrorMessage(text);
	}
}

/**
 * Mappings of the different expected state values to their localized friendly names.
 * These are defined in aris/projects/controller/src/Microsoft.SqlServer.Controller/StateMachines
 */
const stateToDisplayTextMap: { [key: string]: string } = {
	// K8sScaledSetStateMachine
	'creating': localize('state.creating', "Creating"),
	'waiting': localize('state.waiting', "Waiting"),
	'ready': localize('state.ready', "Ready"),
	'deleting': localize('state.deleting', "Deleting"),
	'deleted': localize('state.deleted', "Deleted"),
	'applyingupgrade': localize('state.applyingUpgrade', "Applying Upgrade"),
	'upgrading': localize('state.upgrading', "Upgrading"),
	'applyingmanagedupgrade': localize('state.applyingmanagedupgrade', "Applying Managed Upgrade"),
	'managedupgrading': localize('state.managedUpgrading', "Managed Upgrading"),
	'rollback': localize('state.rollback', "Rollback"),
	'rollbackinprogress': localize('state.rollbackInProgress', "Rollback In Progress"),
	'rollbackcomplete': localize('state.rollbackComplete', "Rollback Complete"),
	'error': localize('state.error', "Error"),

	// BigDataClusterStateMachine
	'creatingsecrets': localize('state.creatingSecrets', "Creating Secrets"),
	'waitingforsecrets': localize('state.waitingForSecrets', "Waiting For Secrets"),
	'creatinggroups': localize('state.creatingGroups', "Creating Groups"),
	'waitingforgroups': localize('state.waitingForGroups', "Waiting For Groups"),
	'creatingresources': localize('state.creatingResources', "Creating Resources"),
	'waitingforresources': localize('state.waitingForResources', "Waiting For Resources"),
	'creatingkerberosdelegationsetup': localize('state.creatingKerberosDelegationSetup', "Creating Kerberos Delegation Setup"),
	'waitingforkerberosdelegationsetup': localize('state.waitingForKerberosDelegationSetup', "Waiting For Kerberos Delegation Setup"),
	'waitingfordeletion': localize('state.waitingForDeletion', "Waiting For Deletion"),
	'waitingforupgrade': localize('state.waitingForUpgrade', "Waiting For Upgrade"),
	'upgradePaused': localize('state.upgradePaused', "Upgrade Paused"),

	// Other
	'running': localize('state.running', "Running"),
};

/**
 * Gets the localized text to display for a corresponding state
 * @param state The state to get the display text for
 */
export function getStateDisplayText(state?: string): string {
	state = state || '';
	return stateToDisplayTextMap[state.toLowerCase()] || state;
}

/**
 * Gets the localized text to display for a corresponding endpoint
 * @param serviceName The endpoint name to get the display text for
 * @param description The backup description to use if we don't have our own
 */
export function getEndpointDisplayText(endpointName?: string, description?: string): string {
	endpointName = endpointName || '';
	switch (endpointName.toLowerCase()) {
		case Endpoint.appProxy:
			return localize('endpoint.appproxy', "Application Proxy");
		case Endpoint.controller:
			return localize('endpoint.controller', "Cluster Management Service");
		case Endpoint.gateway:
			return localize('endpoint.gateway', "Gateway to access HDFS files, Spark");
		case Endpoint.managementProxy:
			return localize('endpoint.managementproxy', "Management Proxy");
		case Endpoint.mgmtproxy:
			return localize('endpoint.mgmtproxy', "Management Proxy");
		case Endpoint.sqlServerMaster:
			return localize('endpoint.sqlServerEndpoint', "SQL Server Master Instance Front-End");
		case Endpoint.metricsui:
			return localize('endpoint.grafana', "Metrics Dashboard");
		case Endpoint.logsui:
			return localize('endpoint.kibana', "Log Search Dashboard");
		case Endpoint.yarnUi:
			return localize('endpoint.yarnHistory', "Spark Diagnostics and Monitoring Dashboard");
		case Endpoint.sparkHistory:
			return localize('endpoint.sparkHistory', "Spark Jobs Management and Monitoring Dashboard");
		case Endpoint.webhdfs:
			return localize('endpoint.webhdfs', "HDFS File System Proxy");
		case Endpoint.livy:
			return localize('endpoint.livy', "Proxy for running Spark statements, jobs, applications");
		default:
			// Default is to use the description if one was given, otherwise worst case just fall back to using the
			// original endpoint name
			return description && description.length > 0 ? description : endpointName;
	}
}

/**
 * Gets the localized text to display for a corresponding service
 * @param serviceName The service name to get the display text for
 */
export function getServiceNameDisplayText(serviceName?: string): string {
	serviceName = serviceName || '';
	switch (serviceName.toLowerCase()) {
		case Service.sql:
			return localize('service.sql', "SQL Server");
		case Service.hdfs:
			return localize('service.hdfs', "HDFS");
		case Service.spark:
			return localize('service.spark', "Spark");
		case Service.control:
			return localize('service.control', "Control");
		case Service.gateway:
			return localize('service.gateway', "Gateway");
		case Service.app:
			return localize('service.app', "App");
		default:
			return serviceName;
	}
}

/**
 * Gets the localized text to display for a corresponding health status
 * @param healthStatus The health status to get the display text for
 */
export function getHealthStatusDisplayText(healthStatus?: string) {
	healthStatus = healthStatus || '';
	switch (healthStatus.toLowerCase()) {
		case 'healthy':
			return localize('bdc.healthy', "Healthy");
		case 'unhealthy':
			return localize('bdc.unhealthy', "Unhealthy");
		default:
			return healthStatus;
	}
}

/**
 * Returns the status icon for the corresponding health status
 * @param healthStatus The status to check
 */
export function getHealthStatusIcon(healthStatus?: string): string {
	healthStatus = healthStatus || '';
	switch (healthStatus.toLowerCase()) {
		case 'healthy':
			return '✔️';
		default:
			// Consider all non-healthy status' as errors
			return '⚠️';
	}
}

/**
 * Returns the status dot icon which will be a • for all non-healthy states
 * @param healthStatus The status to check
 */
export function getHealthStatusDotIcon(healthStatus?: string): constants.IconPath {
	healthStatus = healthStatus || '';
	switch (healthStatus.toLowerCase()) {
		case 'healthy':
			return constants.IconPathHelper.status_circle_blank;
		default:
			// Display status dot for all non-healthy status'
			return constants.IconPathHelper.status_circle_red;
	}
}


interface RawEndpoint {
	serviceName: string;
	description?: string;
	endpoint?: string;
	protocol?: string;
	ipAddress?: string;
	port?: number;
}

interface IEndpoint {
	serviceName: string;
	description: string;
	endpoint: string;
	protocol: string;
}

function getClusterEndpoints(serverInfo: azdata.ServerInfo): IEndpoint[] {
	let endpoints: RawEndpoint[] = serverInfo.options[constants.clusterEndpointsProperty];
	if (!endpoints || endpoints.length === 0) { return []; }

	return endpoints.map(e => {
		// If endpoint is missing, we're on CTP bits. All endpoints from the CTP serverInfo should be treated as HTTPS
		let endpoint = e.endpoint ? e.endpoint : `https://${e.ipAddress}:${e.port}`;
		let updatedEndpoint: IEndpoint = {
			serviceName: e.serviceName,
			description: e.description,
			endpoint: endpoint,
			protocol: e.protocol
		};
		return updatedEndpoint;
	});
}

export function getControllerEndpoint(serverInfo: azdata.ServerInfo): string | undefined {
	let endpoints = getClusterEndpoints(serverInfo);
	if (endpoints) {
		let index = endpoints.findIndex(ep => ep.serviceName.toLowerCase() === constants.controllerEndpointName.toLowerCase());
		if (index < 0) { return undefined; }
		return endpoints[index].endpoint;
	}
	return undefined;
}

export function getBdcStatusErrorMessage(error: Error): string {
	return localize('endpointsError', "Unexpected error retrieving BDC Endpoints: {0}", error.message);
}

const bdcConfigSectionName = 'bigDataCluster';
const ignoreSslConfigName = 'ignoreSslVerification';

/**
 * Retrieves the current setting for whether to ignore SSL verification errors
 */
export function getIgnoreSslVerificationConfigSetting(): boolean {
	try {
		const config = vscode.workspace.getConfiguration(bdcConfigSectionName);
		return config.get<boolean>(ignoreSslConfigName, true);
	} catch (error) {
		console.error(`Unexpected error retrieving ${bdcConfigSectionName}.${ignoreSslConfigName} setting : ${error}`);
	}
	return true;
}
