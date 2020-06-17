/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const arcControllerDashboard = localize('arc.controllerDashboard', "Azure Arc Controller Dashboard (Preview)");
export const miaaDashboard = localize('arc.miaaDashboard', "Managed Instance Dashboard (Preview)");
export const postgresDashboard = localize('arc.postgresDashboard', "Postgres Dashboard (Preview)");

export const dataControllersType = localize('arc.dataControllersType', "Azure Arc Data Controller");
export const pgSqlType = localize('arc.pgSqlType', "PostgreSQL Server group - Azure Arc");
export const miaaType = localize('arc.miaaType', "SQL instance - Azure Arc");

export const overview = localize('arc.overview', "Overview");
export const connectionStrings = localize('arc.connectionStrings', "Connection Strings");
export const networking = localize('arc.networking', "Networking");
export const properties = localize('arc.properties', "Properties");
export const settings = localize('arc.settings', "Settings");
export const security = localize('arc.security', "Security");
export const computeAndStorage = localize('arc.computeAndStorage', "Compute + Storage");
export const compute = localize('arc.compute', "Compute");
export const backup = localize('arc.backup', "Backup");
export const newSupportRequest = localize('arc.newSupportRequest', "New support request");
export const diagnoseAndSolveProblems = localize('arc.diagnoseAndSolveProblems', "Diagnose and solve problems");
export const supportAndTroubleshooting = localize('arc.supportAndTroubleshooting', "Support + troubleshooting");

export const createNew = localize('arc.createNew', "Create New");
export const deleteText = localize('arc.delete', "Delete");
export const resetPassword = localize('arc.resetPassword', "Reset Password");
export const openInAzurePortal = localize('arc.openInAzurePortal', "Open in Azure Portal");
export const resourceGroup = localize('arc.resourceGroup', "Resource Group");
export const region = localize('arc.region', "Region");
export const subscriptionId = localize('arc.subscriptionId', "Subscription ID");
export const state = localize('arc.state', "State");
export const connectionMode = localize('arc.connectionMode', "Connection Mode");
export const namespace = localize('arc.namespace', "Namespace");
export const host = localize('arc.host', "Host");
export const name = localize('arc.name', "Name");
export const type = localize('arc.type', "Type");
export const status = localize('arc.status', "Status");
export const miaaAdmin = localize('arc.miaaAdmin', "Managed instance admin");
export const controllerEndpoint = localize('arc.controllerEndpoint', "Controller endpoint");
export const dataController = localize('arc.dataController', "Data controller");
export const kibanaDashboard = localize('arc.kibanaDashboard', "Kibana Dashboard");
export const grafanaDashboard = localize('arc.grafanaDashboard', "Grafana Dashboard");
export const kibanaDashboardDescription = localize('arc.kibanaDashboardDescription', "Dashboard for viewing logs");
export const grafanaDashboardDescription = localize('arc.grafanaDashboardDescription', "Dashboard for viewing metrics");
export const serviceEndpoints = localize('arc.serviceEndpoints', "Service endpoints");
export const databases = localize('arc.databases', "Databases");
export const endpoint = localize('arc.endpoint', "Endpoint");
export const description = localize('arc.description', "Description");
export const yes = localize('arc.yes', "Yes");
export const no = localize('arc.no', "No");
export const feedback = localize('arc.feedback', "Feedback");
export const selectConnectionString = localize('arc.selectConnectionString', "Select from available client connection strings below.");
export const vCores = localize('arc.vCores', "vCores");
export const ram = localize('arc.ram', "RAM");
export const refresh = localize('arc.refresh', "Refresh");
export const troubleshoot = localize('arc.troubleshoot', "Troubleshoot");
export const clickTheNewSupportRequestButton = localize('arc.clickTheNewSupportRequestButton', "Click the new support request button to file a support request in the Azure Portal.");
export const running = localize('arc.running', "Running");
export const connected = localize('arc.connected', "Connected");
export const disconnected = localize('arc.disconnected', "Disconnected");

// Postgres constants
export const coordinatorEndpoint = localize('arc.coordinatorEndpoint', "Coordinator endpoint");
export const postgresAdminUsername = localize('arc.postgresAdminUsername', "Admin username");
export const nodeConfiguration = localize('arc.nodeConfiguration', "Node configuration");
export const postgresVersion = localize('arc.postgresVersion', "PostgreSQL version");
export const serverGroupType = localize('arc.serverGroupType', "Server group type");
export const serverGroupNodes = localize('arc.serverGroupNodes', "Server group nodes");
export const fullyQualifiedDomain = localize('arc.fullyQualifiedDomain', "Fully qualified domain");
export const postgresArcProductName = localize('arc.postgresArcProductName', "Azure Database for PostgreSQL - Azure Arc");
export const coordinator = localize('arc.coordinator', "Coordinator");
export const worker = localize('arc.worker', "Worker");
export const monitor = localize('arc.monitor', "Monitor");
export const newDatabase = localize('arc.newDatabase', "New Database");
export const databaseName = localize('arc.databaseName', "Database name");
export const newPassword = localize('arc.newPassword', "New password");
export const learnAboutPostgresClients = localize('arc.learnAboutPostgresClients', "Learn more about Azure PostgreSQL Hyperscale client interfaces");
export const node = localize('arc.node', "node");
export const nodes = localize('arc.nodes', "nodes");
export const storagePerNode = localize('arc.storagePerNode', "storage per node");

export function databaseCreated(name: string): string { return localize('arc.databaseCreated', "Database {0} created", name); }
export function databaseCreationFailed(name: string, error: any): string { return localize('arc.databaseCreationFailed', "Failed to create database {0}. {1}", name, (error instanceof Error ? error.message : error)); }
export function passwordReset(name: string): string { return localize('arc.passwordReset', "Password reset for service {0}", name); }
export function passwordResetFailed(name: string, error: any): string { return localize('arc.passwordResetFailed', "Failed to reset password for service {0}. {1}", name, (error instanceof Error ? error.message : error)); }
export function deleteServicePrompt(name: string): string { return localize('arc.deleteServicePrompt', "Delete service {0}?", name); }
export function serviceDeleted(name: string): string { return localize('arc.serviceDeleted', "Service {0} deleted", name); }
export function serviceDeletionFailed(name: string, error: any): string { return localize('arc.serviceDeletionFailed', "Failed to delete service {0}. {1}", name, (error instanceof Error ? error.message : error)); }
export function couldNotFindAzureResource(name: string): string { return localize('arc.couldNotFindAzureResource', "Could not find Azure resource for {0}", name); }
export function copiedToClipboard(name: string): string { return localize('arc.copiedToClipboard', "{0} copied to clipboard", name); }
export function refreshFailed(error: any): string { return localize('arc.refreshFailed', "Refresh failed. {0}", (error instanceof Error ? error.message : error)); }
export function failedToManagePostgres(name: string, error: any): string { return localize('arc.failedToManagePostgres', "Failed to manage Postgres {0}. {1}", name, (error instanceof Error ? error.message : error)); }
export function clickTheTroubleshootButton(resourceType: string): string { return localize('arc.clickTheTroubleshootButton', "Click the troubleshoot button to open the Azure Arc {0} troubleshooting notebook.", resourceType); }
export function numVCores(vCores: string): string {
	const numCores = +vCores;
	if (numCores && numCores > 0) {
		return localize('arc.numVCores', "{0} vCores", numCores);
	} else {
		return '-';
	}
}
export function couldNotFindRegistration(namespace: string, name: string) { return localize('arc.couldNotFindRegistration', "Could not find controller registration for {0} ({1})", name, namespace); }

export const arcResources = localize('arc.arcResources', "Azure Arc Resources");
