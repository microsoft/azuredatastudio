/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

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
			let message = error.message;
			let code = error.code || error.errno;
			text += `${message}${code ? ` (${code})` : ''}`;
		} else {
			text += `${error}`;
		}
		vscode.window.showErrorMessage(text);
	}
}

/**
 * Gets the localized text to display for a corresponding state
 * @param state The state to get the display text for
 */
export function getStateDisplayText(state?: string): string {
	state = state || '';
	switch (state.toLowerCase()) {
		case 'creating':
			return localize('state.creating', "Creating");
		case 'waiting':
			return localize('state.waiting', "Waiting");
		case 'ready':
			return localize('state.ready', "Ready");
		case 'deleting':
			return localize('state.deleting', "Deleting");
		case 'waitingfordeletion':
			return localize('state.waitingForDeletion', "Waiting For Deletion");
		case 'deleted':
			return localize('state.deleted', "Deleted");
		case 'upgrading':
			return localize('state.upgrading', "Upgrading");
		case 'waitingforupgrade':
			return localize('state.waitingForUpgrade', "Waiting For Upgrade");
		case 'error':
			return localize('state.error', "Error");
		case 'running':
			return localize('state.running', "Running");
		default:
			return state;
	}
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
 * Returns the status dot string which will be a • for all non-healthy states
 * @param healthStatus The status to check
 */
export function getHealthStatusDot(healthStatus?: string): string {
	healthStatus = healthStatus || '';
	switch (healthStatus.toLowerCase()) {
		case 'healthy':
			return '';
		default:
			// Display status dot for all non-healthy status'
			return '•';
	}
}
