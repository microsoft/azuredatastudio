/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { ControllerError } from './controller/clusterControllerApi';
const localize = nls.loadMessageBundle();

// Labels
export const statusIcon = localize('bdc.dashboard.status', "Status Icon");
export const instance = localize('bdc.dashboard.instance', "Instance");
export const state = localize('bdc.dashboard.state', "State");
export const view = localize('bdc.dashboard.view', "View");
export const notAvailable = localize('bdc.dashboard.notAvailable', "N/A");
export const healthStatusDetails = localize('bdc.dashboard.healthStatusDetails', "Health Status Details");
export const metricsAndLogs = localize('bdc.dashboard.metricsAndLogs', "Metrics and Logs");
export const healthStatus = localize('bdc.dashboard.healthStatus', "Health Status");
export const nodeMetrics = localize('bdc.dashboard.nodeMetrics', "Node Metrics");
export const sqlMetrics = localize('bdc.dashboard.sqlMetrics', "SQL Metrics");
export const logs = localize('bdc.dashboard.logs', "Logs");
export function viewNodeMetrics(uri: string): string { return localize('bdc.dashboard.viewNodeMetrics', "View Node Metrics {0}", uri); }
export function viewSqlMetrics(uri: string): string { return localize('bdc.dashboard.viewSqlMetrics', "View SQL Metrics {0}", uri); }
export function viewLogs(uri: string): string { return localize('bdc.dashboard.viewLogs', "View Kibana Logs {0}", uri); }
export function lastUpdated(date?: Date): string {
	return localize('bdc.dashboard.lastUpdated', "Last Updated : {0}",
		date ?
			`${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
			: '-');
}
export const basic = localize('basicAuthName', "Basic");
export const windowsAuth = localize('integratedAuthName', "Windows Authentication");
export const addNewController = localize('addNewController', "Add New Controller");
export const url = localize('url', "URL");
export const username = localize('username', "Username");
export const password = localize('password', "Password");
export const rememberPassword = localize('rememberPassword', "Remember Password");
export const clusterUrl = localize('clusterManagementUrl', "Cluster Management URL");
export const authType = localize('textAuthCapital', "Authentication type");
export const clusterConnection = localize('hdsf.dialog.connection.section', "Cluster Connection");
export const add = localize('add', "Add");
export const cancel = localize('cancel', "Cancel");
export const ok = localize('ok', "OK");
export const refresh = localize('bdc.dashboard.refresh', "Refresh");
export const troubleshoot = localize('bdc.dashboard.troubleshoot', "Troubleshoot");
export const bdcOverview = localize('bdc.dashboard.bdcOverview', "Big Data Cluster overview");
export const clusterDetails = localize('bdc.dashboard.clusterDetails', "Cluster Details");
export const clusterOverview = localize('bdc.dashboard.clusterOverview', "Cluster Overview");
export const serviceEndpoints = localize('bdc.dashboard.serviceEndpoints', "Service Endpoints");
export const clusterProperties = localize('bdc.dashboard.clusterProperties', "Cluster Properties");
export const clusterState = localize('bdc.dashboard.clusterState', "Cluster State");
export const serviceName = localize('bdc.dashboard.serviceName', "Service Name");
export const service = localize('bdc.dashboard.service', "Service");
export const endpoint = localize('bdc.dashboard.endpoint', "Endpoint");
export function copiedEndpoint(endpointName: string): string { return localize('copiedEndpoint', "Endpoint '{0}' copied to clipboard", endpointName); }
export const copy = localize('bdc.dashboard.copy', "Copy");
export const viewDetails = localize('bdc.dashboard.viewDetails', "View Details");
export const viewErrorDetails = localize('bdc.dashboard.viewErrorDetails', "View Error Details");
export const connectToController = localize('connectController.dialog.title', "Connect to Controller");
export const mountConfiguration = localize('mount.main.section', "Mount Configuration");
export function mountTask(path: string): string { return localize('mount.task.name', "Mounting HDFS folder on path {0}", path); }
export function refreshMountTask(path: string): string { return localize('refreshmount.task.name', "Refreshing HDFS Mount on path {0}", path); }
export function deleteMountTask(path: string): string { return localize('deletemount.task.name', "Deleting HDFS Mount on path {0}", path); }
export const mountTaskSubmitted = localize('mount.task.submitted', "Mount creation has started");
export const refreshMountTaskSubmitted = localize('refreshmount.task.submitted', "Refresh mount request submitted");
export const deleteMountTaskSubmitted = localize('deletemount.task.submitted', "Delete mount request submitted");
export const mountCompleted = localize('mount.task.complete', "Mounting HDFS folder is complete");
export const mountInProgress = localize('mount.task.inprogress', "Mounting is likely to complete, check back later to verify");
export const mountFolder = localize('mount.dialog.title', "Mount HDFS Folder");
export const hdfsPath = localize('mount.hdfsPath.title', "HDFS Path");
export const hdfsPathInfo = localize('mount.hdfsPath.info', "Path to a new (non-existing) directory which you want to associate with the mount");
export const remoteUri = localize('mount.remoteUri.title', "Remote URI");
export const remoteUriInfo = localize('mount.remoteUri.info', "The URI to the remote data source. Example for ADLS: abfs://fs@saccount.dfs.core.windows.net/");
export const credentials = localize('mount.credentials.title', "Credentials");
export const credentialsInfo = localize('mount.credentials.info', "Mount credentials for authentication to remote data source for reads");
export const refreshMount = localize('refreshmount.dialog.title', "Refresh Mount");
export const deleteMount = localize('deleteMount.dialog.title', "Delete Mount");
export const loadingClusterStateCompleted = localize('bdc.dashboard.loadingClusterStateCompleted', "Loading cluster state completed");
export const loadingHealthStatusCompleted = localize('bdc.dashboard.loadingHealthStatusCompleted', "Loading health status completed");

// Errors
export const usernameRequired = localize('err.controller.username.required', "Username is required");
export const passwordRequired = localize('err.controller.password.required', "Password is required");
export function endpointsError(msg: string): string { return localize('endpointsError', "Unexpected error retrieving BDC Endpoints: {0}", msg); }
export const noConnectionError = localize('bdc.dashboard.noConnection', "The dashboard requires a connection. Please click retry to enter your credentials.");
export function unexpectedError(error: Error): string { return localize('bdc.dashboard.unexpectedError', "Unexpected error occurred: {0}", error.message); }
export const loginFailed = localize('mount.hdfs.loginerror1', "Login to controller failed");
export function loginFailedWithError(error: ControllerError): string { return localize('mount.hdfs.loginerror2', "Login to controller failed: {0}", error.statusMessage || error.message); }
export function badCredentialsFormatting(pair: string): string { return localize('mount.err.formatting', "Bad formatting of credentials at {0}", pair); }
export function mountError(error: any): string { return localize('mount.task.error', "Error mounting folder: {0}", (error instanceof Error ? error.message : error)); }
export const mountErrorUnknown = localize('mount.error.unknown', "Unknown error occurred during the mount process");
