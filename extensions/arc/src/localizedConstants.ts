/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { getErrorMessage } from './common/utils';
const localize = nls.loadMessageBundle();

export const arcDeploymentDeprecation = localize('arc.arcDeploymentDeprecation', "The Arc Deployment extension has been replaced by the Arc extension and has been uninstalled.");
export function arcControllerDashboard(name: string): string { return localize('arc.controllerDashboard', "Azure Arc Data Controller Dashboard - {0}", name); }
export function miaaDashboard(name: string): string { return localize('arc.miaaDashboard', "SQL managed instance - Azure Arc Dashboard - {0}", name); }
export function postgresDashboard(name: string): string { return localize('arc.postgresDashboard', "PostgreSQL server - Azure Arc Dashboard (Preview) - {0}", name); }

export const dataControllersType = localize('arc.dataControllersType', "Azure Arc Data Controller");
export const pgSqlType = localize('arc.pgSqlType', "PostgreSQL server - Azure Arc");
export const miaaType = localize('arc.miaaType', "SQL managed instance - Azure Arc");

export const overview = localize('arc.overview', "Overview");
export const connectionStrings = localize('arc.connectionStrings', "Connection Strings");
export const preLoadedExtensions = localize('arc.preloaded Extensions', "Preloaded Extensions");
export const networking = localize('arc.networking', "Networking");
export const properties = localize('arc.properties', "Properties");
export const settings = localize('arc.settings', "Settings");
export const security = localize('arc.security', "Security");
export const computeAndStorage = localize('arc.computeAndStorage', "Compute + Storage");
export const backups = localize('arc.backups', "Backups");
export const coordinatorNodeParameters = localize('arc.coordinatorNodeParameters', "Coordinator Node Parameters");
export const workerNodeParameters = localize('arc.workerNodeParameters', "Worker Node Parameters");
export const compute = localize('arc.compute', "Compute");
export const backup = localize('arc.backup', "Backup");
export const newSupportRequest = localize('arc.newSupportRequest', "New support request");
export const diagnoseAndSolveProblems = localize('arc.diagnoseAndSolveProblems', "Diagnose and solve problems");
export const supportAndTroubleshooting = localize('arc.supportAndTroubleshooting', "Support + troubleshooting");
export const resourceHealth = localize('arc.resourceHealth', "Resource health");
export const parameterName = localize('arc.parameterName', "Parameter Name");
export const value = localize('arc.value', "Value");
export const newInstance = localize('arc.createNew', "New Instance");
export const deleteText = localize('arc.delete', "Delete");
export const learnMore = localize('arc.learnMore', "Learn More.");
export const dropText = localize('arc.drop', "Drop");
export const saveText = localize('arc.save', "Save");
export const discardText = localize('arc.discard', "Discard");
export const resetPassword = localize('arc.resetPassword', "Reset Password");
export const loadExtensions = localize('arc.loadExtensions', "Load extensions");
export const configureRP = localize('arc.configureRP', "Configure retention policy");
export const unloadExtensions = localize('arc.unloadExtensions', "Unload extensions");
export const noExtensions = localize('arc.noExtensions', "No extensions listed in configuration.");
export const openInAzurePortal = localize('arc.openInAzurePortal', "Open in Azure Portal");
export const resourceGroup = localize('arc.resourceGroup', "Resource Group");
export const region = localize('arc.region', "Region");
export const subscriptionId = localize('arc.subscriptionId', "Subscription ID");
export const subscription = localize('arc.subscription', "Subscription");
export const state = localize('arc.state', "State");
export const connectionMode = localize('arc.connectionMode', "Connection Mode");
export const namespace = localize('arc.namespace', "Namespace");
export const externalEndpoint = localize('arc.externalEndpoint', "External Endpoint");
export const name = localize('arc.name', "Name");
export const type = localize('arc.type', "Type");
export const status = localize('arc.status', "Status");
export const database = localize('arc.database', "Database");
export const sourceDatabase = localize('arc.sourceDatabase', "Source database");
export const earliestPitrRestorePoint = localize('arc.earliestPitrRestorePoint', "Earliest point in time");
export const latestpitrRestorePoint = localize('arc.latestpitrRestorePoint', "Latest point in time");
export const pitr = localize('arc.pitr', "Point in time restore");
export const projectDetails = localize('arc.projectDetails', "Project Details");
export const projectDetailsText = localize('arc.projectDetailsText', "Select the subscription to manage deployed resources. Use resource groups like folders to organize and manage all your resources.");
export const sourceDetails = localize('arc.sourceDetails', "Source Details");
export const sourceDetailsText = localize('arc.sourceDetailsText', "Select a backup source and provide details. Additional settings will be defaulted where possible based on the selected database.");
export const databaseDetails = localize('arc.databaseDetails', "Destination Details");
export const restorePointDetails = localize('arc.restorePointDetails', "Restore Point Details");
export const databaseDetailsText = localize('arc.databaseDetailsText', "Enter the required settings for target database name and SQL managed instance. By default, the source managed instance is selected.");
export const restore = localize('arc.restore', "Restore");
export const instance = localize('arc.instance', "Instance");
export const restorePoint = localize('arc.restorePoint', "Restore point (UTC), in a time format: 'YYYY-MM-DDTHH:MM:SSZ");
export const restoreDatabase = localize('arc.restoreDatabase', "Restore Database");
export const miaaAdmin = localize('arc.miaaAdmin', "Managed instance admin");
export const extensionName = localize('arc.extensionName', "Extension name");
export const extensionsDescription = localize('arc.extensionsDescription', "PostgreSQL provides the ability to extend the functionality of your database by using extensions. Extensions allow for bundling multiple related SQL objects together in a single package that can be loaded or removed from your database with a single command. After being loaded in the database, extensions can function like built-in features.");
export const extensionsFunction = localize('arc.extensionsFunction', "Some extensions must be loaded into PostgreSQL at startup time before they can be used. These preloaded extensions can be viewed and edited  below.");
export function extensionsAddFunction(extensions: string): string { return localize('arc.extensionsAddFunction', "Some extensions must be loaded into PostgreSQL at startup time before they can be used. To edit, type in comma separated list of valid extensions: ({0}).", extensions); }
export function extensionsAddErrorrMessage(extensions: string): string { return localize('arc.extensionsAddErrorrMessage', "Value should be either of the following: ({0}).", extensions); }
export function restorePointErrorMessage(earliestPoint: string, latestPoint: string) { return localize('arc.restorePointErrorrMessage', "Provide time in correct format and within range: {0} to {1}", earliestPoint, latestPoint); }
export const extensionsLearnMore = localize('arc.extensionsLearnMore', "Learn more about PostgreSQL extensions.");
export const extensionsTableLoading = localize('arc.extensionsTableLoading', "Table of preloaded extensions are loading.");
export const extensionsTableLabel = localize('arc.extensionsTableLabel', "Table of preloaded extensions.");
export const extensionsTableLoadingComplete = localize('arc.extensionsTableLoadingComplete', "Preloaded extensions can now be viewed.");
export const extensionsAddList = localize('arc.extensionsAddList', "Extensions");
export const extensionsAddDialog = localize('arc.extensionsAddDialog', "PostgreSQL provides the ability to extend the functionality of your database by using extensions.");
export const dataController = localize('arc.dataController', "Data controller");
export const kibanaDashboard = localize('arc.kibanaDashboard', "Kibana Dashboard");
export const grafanaDashboard = localize('arc.grafanaDashboard', "Grafana Dashboard");
export const kibanaDashboardDescription = localize('arc.kibanaDashboardDescription', "Dashboard for viewing logs");
export const grafanaDashboardDescription = localize('arc.grafanaDashboardDescription', "Dashboard for viewing metrics");
export const serviceEndpoints = localize('arc.serviceEndpoints', "Service endpoints");
export const serviceEndpointsTable = localize('arc.serviceEndpointsTable', "Service endpoints table");
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
export const configureRetentionPolicyButton = localize('arc.configureRetentionPolicyButton', "Configure Retention Policy");
export const resetAllToDefault = localize('arc.resetAllToDefault', "Reset all to default");
export const resetToDefault = localize('arc.resetToDefault', "Reset to default");
export const troubleshoot = localize('arc.troubleshoot', "Troubleshoot");
export const clickTheNewSupportRequestButton = localize('arc.clickTheNewSupportRequestButton', "Click the new support request button to file a support request in the Azure Portal.");
export const supportRequestNote = localize('arc.supportRequestNote', "Note that the resource configuration must have been uploaded to Azure first in order to open a support request.");
export const running = localize('arc.running', "Running");
export const ready = localize('arc.ready', "Ready");
export const notReady = localize('arc.notReady', "Not Ready");
export const pending = localize('arc.pending', "Pending");
export const failed = localize('arc.failed', "Failed");
export const unknown = localize('arc.unknown', "Unknown");
export const direct = localize('arc.direct', "Direct");
export const indirect = localize('arc.indirect', "Indirect");
export const loading = localize('arc.loading', "Loading...");
export const refreshToEnterCredentials = localize('arc.refreshToEnterCredentials', "Refresh node to enter credentials");
export const noInstancesAvailable = localize('arc.noInstancesAvailable', "No instances available");
export const connectToServer = localize('arc.connectToServer', "Connect to Server");
export const connectToController = localize('arc.connectToController', "Connect to Existing Controller");
export function connectToMSSql(name: string): string { return localize('arc.connectToMSSql', "Connect to SQL managed instance - Azure Arc ({0})", name); }
export function connectToPGSql(name: string): string { return localize('arc.connectToPGSql', "Connect to PostgreSQL server - Azure Arc ({0})", name); }
export const passwordToController = localize('arc.passwordToController', "Provide Password to Controller");
export const controllerUrl = localize('arc.controllerUrl', "Controller URL");
export const controllerUrlPlaceholder = localize('arc.controllerUrlPlaceholder', "https://<IP or hostname>:<port>");
export const controllerUrlDescription = localize('arc.controllerUrlDescription', "The Controller URL is necessary if there are multiple clusters with the same namespace - this should generally not be necessary.");
export const serverEndpoint = localize('arc.serverEndpoint', "Server Endpoint");
export const controllerName = localize('arc.controllerName', "Name");
export const controllerNameDescription = localize('arc.controllerNameDescription', "The name to display in the tree view, this is not applied to the controller itself.");
export const controllerKubeConfig = localize('arc.controllerKubeConfig', "Kube Config File Path");
export const controllerClusterContext = localize('arc.controllerClusterContext', "Cluster Context");
export const defaultControllerName = localize('arc.defaultControllerName', "arc-dc");
export const postgresProviderName = localize('arc.postgresProviderName', "PGSQL");
export const miaaProviderName = localize('arc.miaaProviderName', "MSSQL");
export const controllerUsername = localize('arc.controllerUsername', "Controller Username");
export const controllerPassword = localize('arc.controllerPassword', "Controller Password");
export const username = localize('arc.username', "Username");
export const password = localize('arc.password', "Password");
export const rememberPassword = localize('arc.rememberPassword', "Remember Password");
export const encrypt = localize('arc.encrypt', "Encrypt");
export const encryptDescription = localize('arc.encryptDescription', "When true, SQL Server uses SSL encryption for all data sent between the client and server if the server has a certificate installed.");
export const trustServerCertificate = localize('arc.trustServerCertificate', "Trust Server Certificate");
export const trustServerCertDescription = localize('arc.trustServerCertDescription', "When true (and encrypt=true), SQL Server uses SSL encryption for all data sent between the client and server without validating the server certificate.");
export const enableTrustServerCert = localize('arc.enableTrustServerCert', "Enable Trust Server Certificate");
export const msgPromptSSLCertificateValidationFailed = localize('arc.msgPromptSSLCertificateValidationFailed', 'Encryption was enabled on this connection, review your SSL and certificate configuration for the target SQL Server, or set \'Trust server certificate\' to \'true\' in the settings file. Note: A self-signed certificate offers only limited protection and is not a recommended practice for production environments. Do you want to enable \'Trust server certificate\' on this connection and retry?');
export const connect = localize('arc.connect', "Connect");
export const readMore = localize('arc.readMore', "Read more");
export const cancel = localize('arc.cancel', "Cancel");
export const apply = localize('arc.apply', "Apply");
export const ok = localize('arc.ok', "Ok");
export const on = localize('arc.on', "On");
export const off = localize('arc.off', "Off");
export const booleantrue = localize('arc.booleantrue', "True");
export const booleanfalse = localize('arc.booleanfalse', "False");
export const notConfigured = localize('arc.notConfigured', "Not Configured");

// Database States - see https://docs.microsoft.com/sql/relational-databases/databases/database-states
export const online = localize('arc.online', "Online");
export const offline = localize('arc.offline', "Offline");
export const restoring = localize('arc.restoring', "Restoring");
export const recovering = localize('arc.recovering', "Recovering");
export const recoveryPending = localize('arc.recoveringPending', "Recovery Pending");
export const suspect = localize('arc.suspect', "Suspect");
export const emergency = localize('arc.emergency', "Emergency");

// Postgres constants
export const coordinatorEndpoint = localize('arc.coordinatorEndpoint', "Coordinator endpoint");
export const postgresAdminUsername = localize('arc.postgresAdminUsername', "Admin username");
export const postgresVersion = localize('arc.postgresVersion', "PostgreSQL version");
export const serverGroupType = localize('arc.serverGroupType', "Server group type");
export const server = localize('arc.server', "Server");
export const fullyQualifiedDomain = localize('arc.fullyQualifiedDomain', "Fully qualified domain");
export const postgresArcProductName = localize('arc.postgresArcProductName', "Azure Database for PostgreSQL - Azure Arc");
export const coordinator = localize('arc.coordinator', "Coordinator");
export const worker = localize('arc.worker', "Worker");
export const monitor = localize('arc.monitor', "Monitor");
export const available = localize('arc.available', "Available");
export const issuesDetected = localize('arc.issuesDetected', "Issues Detected");
export const newDatabase = localize('arc.newDatabase', "New Database");
export const databaseName = localize('arc.databaseName', "Database name");
export const enterNewPassword = localize('arc.enterNewPassword', "Enter a new password");
export const confirmNewPassword = localize('arc.confirmNewPassword', "Confirm the new password");
export const learnAboutPostgresClients = localize('arc.learnAboutPostgresClients', "Learn more about Azure PostgreSQL client interfaces");
export const coordinatorNodeParametersDescription = localize('arc.coordinatorNodeParametersDescription', " These server parameters of the Coordinator node can be set to custom (non-default) values. Search to find parameters.");
export const workerNodesParametersDescription = localize('arc.workerNodesParametersDescription', " These server parameters of the Worker nodes can be set to custom (non-default) values. Search to find parameters.");
export const learnAboutNodeParameters = localize('arc.learnAboutNodeParameters', "Learn more about database engine settings for Azure Arc-enabled PostgreSQL");
export const noNodeParametersFound = localize('arc.noNodeParametersFound', "No worker server parameters found...");
export const searchToFilter = localize('arc.searchToFilter', "Search to filter items...");
export const scalingCompute = localize('arc.scalingCompute', "scaling compute vCores and memory.");
export const postgresComputeAndStorageDescriptionPartOne = localize('arc.postgresComputeAndStorageDescriptionPartOne', "You can scale your Azure Arc-enabled");
export const miaaComputeAndStorageDescriptionPartOne = localize('arc.miaaComputeAndStorageDescriptionPartOne', "You can scale your Azure SQL managed instance - Azure Arc by");
export const miaaBackupsDatabasesDescription = localize('arc.miaaBackupsDatabasesDescription', "Databases with available backups are displayed below. Restore databases to this instance or any other instance within the same custom location.");
export const pitrInfo = localize('arc.pitrInfo', "Specify how long you want to keep your point-in-time backups. Customize this for backup availability.");
export const restoreInfo = localize('arc.restoreInfo', "Restore a database to an Azure Arc enabled SQL Managed Instance.");
export const restorePointText = localize('arc.restorePointText', "Enter a restore point in the specified time format within given range of earliest and latest restore time.");
export const postgresComputeAndStorageDescriptionPartTwo = localize('arc.postgres.computeAndStorageDescriptionPartTwo', "PostgreSQL by");
export const computeAndStorageDescriptionPartThree = localize('arc.computeAndStorageDescriptionPartThree', "without downtime and by");
export const computeAndStorageDescriptionPartFour = localize('arc.computeAndStorageDescriptionPartFour', "Before doing so, you need to ensure");
export const computeAndStorageDescriptionPartFive = localize('arc.computeAndStorageDescriptionPartFive', "there are sufficient resources available");
export const resourceHealthDescription = localize('arc.resourceHealthDescription', "Resource health can tell you if your resource is running as expected.");
export const computeAndStorageDescriptionPartSix = localize('arc.computeAndStorageDescriptionPartSix', "in your Kubernetes cluster to honor this configuration.");
export const node = localize('arc.node', "node");
export const nodes = localize('arc.nodes', "nodes");
export const workerNodes = localize('arc.workerNodes', "Worker Nodes");
export const storagePerNode = localize('arc.storagePerNode', "storage per node");
export const workerNodeCount = localize('arc.workerNodeCount', "Worker node count");
export const computeConfiguration = localize('arc.computeConfiguration', "Compute Configuration");
export const configurationPerNode = localize('arc.configurationPerNode', "Configuration");
export const coresLimit = localize('arc.coresLimit', "CPU limit");
export const coresRequest = localize('arc.coresRequest', "CPU request");
export const memoryLimit = localize('arc.memoryLimit', "Memory limit (in GB)");
export const retentionDays = localize('arc.retentionDays', "Point-In-Time Recovery retention (days)");
export const memoryRequest = localize('arc.memoryRequest', "Memory request (in GB)");
export const syncSecondaryToCommit = localize('arc.syncSecondaryToCommit', "Sync Secondary To Commit");
export const arcResources = localize('arc.arcResources', "Azure Arc Resources");
export const enterANonEmptyPassword = localize('arc.enterANonEmptyPassword', "Enter a non empty password or press escape to exit.");
export const thePasswordsDoNotMatch = localize('arc.thePasswordsDoNotMatch', "The passwords do not match. Confirm the password or press escape to exit.");
export const passwordReset = localize('arc.passwordReset', "Password reset successfully");
export const condition = localize('arc.condition', "Condition");
export const details = localize('arc.details', "Details");
export const lastTransition = localize('arc.lastTransition', "Last transition");
export const noExternalEndpoint = localize('arc.noExternalEndpoint', "No External Endpoint has been configured so this information isn't available.");
export const noWorkerPods = localize('arc.noWorkerPods', "No worker pods in this configuration.");
export const podsReady = localize('arc.podsReady', "pods ready");
export const podsPresent = localize('arc.podsPresent', "Pods Present");
export const podsUsedDescription = localize('arc.podsUsedDescription', "Select a pod in the dropdown below for detailed health information.");
export const podsUsedDescriptionAria = localize('arc.podsUsedDescriptionAria', "Select a pod in the dropdown below for detailed health information");
export const podConditionsTable = localize('arc.podConditionsTable', "Pod conditions table");
export const connectToPostgresDescription = localize('arc.connectToPostgresDescription', "A connection to the server is required to show and set database engine settings, which will require the PostgreSQL Extension to be installed.");
export const postgresExtension = localize('arc.postgresExtension', "microsoft.azuredatastudio-postgresql");
export const podInitialized = localize('arc.podInitialized', "Pod is initialized.");
export const podReady = localize('arc.podReady', "Pod is ready.");
// allow-any-unicode-next-line
export const noPodIssuesDetected = localize('arc.noPodIssuesDetected', "There aren’t any known issues affecting this PostgreSQL instance.");
export const podIssuesDetected = localize('arc.podIssuesDetected', "The pods listed below are experiencing issues that may affect performance or availability.");
export const containerReady = localize('arc.containerReady', "Pod containers are ready.");
export const podScheduled = localize('arc.podScheduled', "Pod is schedulable.");
export const loadingClusterContextCompleted = localize('arc.loadingClusterContextCompleted', "Loading cluster contexts completed");
export function rangeSetting(min: string, max: string): string { return localize('arc.rangeSetting', "Value is expected to be in the range {0} - {1}", min, max); }
export function databaseCreated(name: string): string { return localize('arc.databaseCreated', "Database {0} created", name); }
export function deletingInstance(name: string): string { return localize('arc.deletingInstance', "Deleting instance '{0}'...", name); }
export function installingExtension(name: string): string { return localize('arc.installingExtension', "Installing extension '{0}'...", name); }
export function extensionInstalled(name: string): string { return localize('arc.extensionInstalled', "Extension '{0}' has been installed.", name); }
export function updatingInstance(name: string): string { return localize('arc.updatingInstance', "Updating instance '{0}'...", name); }
export function upgradingDirectDC(name: string, desiredVersion: string, resourceGroup: string): string { return localize('arc.upgradingDirectDC', "Upgrading data controller '{0}' with command 'az arcdata dc upgrade --desired-version {1} --name {0} --resource-group {2}'", name, desiredVersion, resourceGroup); }
export function upgradingIndirectDC(name: string, desiredVersion: string, namespace: string): string { return localize('arc.upgradingIndirectDC', "Upgrading data controller '{0}' with command 'az arcdata dc upgrade --desired-version {1} --name {0} --k8s-namespace {2} --use-k8s'", name, desiredVersion, namespace); }
export function upgradingDirectMiaa(name: string, resourceGroup: string): string { return localize('arc.upgradingDirectMiaa', "Upgrading SQL MIAA '{0}' with command 'az sql mi-arc upgrade --name {0} --resource-group {1}'", name, resourceGroup); }
export function upgradingIndirectMiaa(name: string, namespace: string): string { return localize('arc.upgradingIndirectMiaa', "Upgrading SQL MIAA '{0}' with command 'az sql mi-arc upgrade --name {0} --k8s-namespace {1} --use-k8s'", name, namespace); }
export function instanceDeleted(name: string): string { return localize('arc.instanceDeleted', "Instance '{0}' deleted", name); }
export function instanceUpdated(name: string): string { return localize('arc.instanceUpdated', "Instance '{0}' updated", name); }
export function extensionsDropped(name: string): string { return localize('arc.extensionsDropped', "Extensions '{0}' dropped", name); }
export function extensionsAdded(name: string): string { return localize('arc.extensionsAdded', "Extensions '{0}' added", name); }
export function copiedToClipboard(name: string): string { return localize('arc.copiedToClipboard', "{0} copied to clipboard", name); }
export function clickTheTroubleshootButton(resourceType: string): string { return localize('arc.clickTheTroubleshootButton', "Click the troubleshoot button to open the Azure Arc {0} troubleshooting notebook.", resourceType); }
export function dataStorage(value: string): string { return localize('arc.dataStorage', "{0} data", value); }
export function logStorage(value: string): string { return localize('arc.logStorage', "{0} log", value); }
export function backupsStorage(value: string): string { return localize('arc.backupsStorage', "{0} backups", value); }
export function numVCores(vCores: string | undefined): string {
	if (vCores && +vCores > 0) {
		if (+vCores === 1) {
			return localize('arc.numVCore', "{0} vCore", vCores);
		} else {
			return localize('arc.numVCores', "{0} vCores", vCores);
		}
	} else {
		return '-';
	}
}
export function updated(when: string): string { return localize('arc.updated', "Updated {0}", when); }
export function connectionString(type: string): string { return localize({ key: 'arc.connectionString', comment: ['{0} is the name of the type of connection string (e.g. Java)'] }, "Connection string for {0}", type); }
export function copyConnectionStringToClipboard(type: string): string { return localize({ key: 'arc.copyConnectionStringToClipboard', comment: ['{0} is the name of the type of connection string (e.g. Java)'] }, "Copy {0} Connection String to clipboard", type); }
export function copyValueToClipboard(valueName: string): string { return localize({ key: 'arc.copyValueToClipboard', comment: ['{0} is the name of the type of value being copied (e.g. Coordinator endpoint)'] }, "Copy {0} to clipboard", valueName); }

// Pricing Constants
export const replicaOne = localize('arc.replicaOne', "1");
export const replicaTwo = localize('arc.replicaTwo', "2");
export const replicaThree = localize('arc.replicaThree', "3");
export const generalPurposeLabel = localize('arc.generalPurposeLabel', "GeneralPurpose");
export const businessCriticalLabel = localize('arc.businessCriticalLabel', "BusinessCritical");
export const USD = localize('arc.USD', "USD");

// Errors
export const pgConnectionRequired = localize('arc.pgConnectionRequired', "A connection is required to show and set database engine settings.");
export const miaaConnectionRequired = localize('arc.miaaConnectionRequired', "A connection is required to list the databases on this instance.");
export const couldNotFindControllerRegistration = localize('arc.couldNotFindControllerRegistration', "Could not find controller registration.");
export const dropMultipleExtensions = localize('arc.dropMultipleExtensions', "Currently dropping another extension, try again once that is completed.");
export function updateExtensionsFailed(error: any): string { return localize('arc.updateExtensionsFailed', "Editing extensions failed. {0}", getErrorMessage(error)); }
export function refreshFailed(error: any): string { return localize('arc.refreshFailed', "Refresh failed. {0}", getErrorMessage(error)); }
export function restoreTimeWindowUpdateFailed(error: any): string { return localize('arc.restoreTimeWindowUpdateFailed', "Point in time restore time window update failed. {0}", getErrorMessage(error)); }
export function resetFailed(error: any): string { return localize('arc.resetFailed', "Reset failed. {0}", getErrorMessage(error)); }
export function openDashboardFailed(error: any): string { return localize('arc.openDashboardFailed', "Error opening dashboard. {0}", getErrorMessage(error)); }
export function instanceDeletionFailed(name: string, error: any): string { return localize('arc.instanceDeletionFailed', "Failed to delete instance {0}. {1}", name, getErrorMessage(error)); }
export function instanceUpdateFailed(name: string, error: any): string { return localize('arc.instanceUpdateFailed', "Failed to update instance {0}. {1}", name, getErrorMessage(error)); }
export function pageDiscardFailed(error: any): string { return localize('arc.pageDiscardFailed', "Failed to discard user input. {0}", getErrorMessage(error)); }
export function databaseCreationFailed(name: string, error: any): string { return localize('arc.databaseCreationFailed', "Failed to create database {0}. {1}", name, getErrorMessage(error)); }
export function connectToControllerFailed(url: string, error: any): string { return localize('arc.connectToControllerFailed', "Could not connect to controller {0}. {1}", url, getErrorMessage(error)); }
export function connectToMSSqlFailed(serverName: string, error: any): string { return localize('arc.connectToMSSqlFailed', "Could not connect to SQL managed instance - Azure Arc Instance {0}. {1}", serverName, getErrorMessage(error)); }
export function connectToPGSqlFailed(serverName: string, error: any): string { return localize('arc.connectToPGSqlFailed', "Could not connect to PostgreSQL server - Azure Arc Instance {0}. {1}", serverName, getErrorMessage(error)); }
export function missingExtension(extensionName: string): string { return localize('arc.missingExtension', "The {0} extension is required to view engine settings. Do you wish to install it now?", extensionName); }
export function extensionInstallationFailed(extensionName: string): string { return localize('arc.extensionInstallationFailed', "Failed to install extension {0}.", extensionName); }
export function fetchConfigFailed(name: string, error: any): string { return localize('arc.fetchConfigFailed', "An unexpected error occurred retrieving the config for '{0}'. {1}", name, getErrorMessage(error)); }
export function fetchEndpointsFailed(name: string, error: any): string { return localize('arc.fetchEndpointsFailed', "An unexpected error occurred retrieving the endpoints for '{0}'. {1}", name, getErrorMessage(error)); }
export function fetchRegistrationsFailed(name: string, error: any): string { return localize('arc.fetchRegistrationsFailed', "An unexpected error occurred retrieving the registrations for '{0}'. {1}", name, getErrorMessage(error)); }
export function fetchDatabasesFailed(name: string, error: any): string { return localize('arc.fetchDatabasesFailed', "An unexpected error occurred retrieving the databases for '{0}'. {1}", name, getErrorMessage(error)); }
export function fetchEngineSettingsFailed(name: string, error: any): string { return localize('arc.fetchEngineSettingsFailed', "An unexpected error occurred retrieving the engine settings for '{0}'. {1}", name, getErrorMessage(error)); }
export function numberOfIssuesDetected(name: string, issues: number): string { return localize('arc.numberOfIssuesDetected', "• {0} ({1} issues)", name, issues); }
export function instanceDeletionWarning(name: string): string { return localize('arc.instanceDeletionWarning', "Warning! Deleting an instance is permanent and cannot be undone. To delete the instance '{0}' type the name '{0}' below to proceed.", name); }
export function invalidInstanceDeletionName(name: string): string { return localize('arc.invalidInstanceDeletionName', "The value '{0}' does not match the instance name. Try again or press escape to exit", name); }
export function couldNotFindAzureResource(name: string): string { return localize('arc.couldNotFindAzureResource', "Could not find Azure resource for {0}", name); }
export function passwordResetFailed(error: any): string { return localize('arc.passwordResetFailed', "Failed to reset password. {0}", getErrorMessage(error)); }
export function errorConnectingToController(error: any): string { return localize('arc.errorConnectingToController', "Error connecting to controller. {0}", getErrorMessage(error, true)); }
export function passwordAcquisitionFailed(error: any): string { return localize('arc.passwordAcquisitionFailed', "Failed to acquire password. {0}", getErrorMessage(error)); }
export const loginFailed = localize('arc.loginFailed', "Error logging into controller - wrong username or password");
export function errorVerifyingPassword(error: any): string { return localize('arc.errorVerifyingPassword', "Error encountered while verifying password. {0}", getErrorMessage(error)); }
export const noControllersConnected = localize('noControllersConnected', "No Azure Arc controllers are currently connected. Please run the command: 'Connect to Existing Azure Arc Controller' and then try again");
export const variableValueFetchForUnsupportedVariable = (variableName: string) => localize('getVariableValue.unknownVariableName', "Attempt to get variable value for unknown variable:{0}", variableName);
export const isPasswordFetchForUnsupportedVariable = (variableName: string) => localize('getIsPassword.unknownVariableName', "Attempt to get isPassword for unknown variable:{0}", variableName);
export const noControllerInfoFound = (name: string) => localize('noControllerInfoFound', "Controller Info could not be found with name: {0}", name);
export const noPasswordFound = (controllerName: string) => localize('noPasswordFound', "Password could not be retrieved for controller: {0} and user did not provide a password. Please retry later.", controllerName);
export const clusterContextNotFound = (clusterContext: string) => localize('clusterContextNotFound', "Cluster Context with name: {0} not found in the Kube config file", clusterContext);
export const noCurrentClusterContext = localize('noCurrentClusterContext', "No current cluster context was found in the kube config file");
export const browse = localize('filePicker.browse', "Browse");
export const select = localize('button.label', "Select");
export const noContextFound = (configFile: string) => localize('noContextFound', "No 'contexts' found in the config file: {0}", configFile);
export const noCurrentContextFound = (configFile: string) => localize('noCurrentContextFound', "No context is marked as 'current-context' in the config file: {0}", configFile);
export const noNameInContext = (configFile: string) => localize('noNameInContext', "No name field was found in a cluster context in the config file: {0}", configFile);
export const userCancelledError = localize('arc.userCancelledError', "User cancelled the dialog");
export const clusterContextConfigNoLongerValid = (configFile: string, clusterContext: string, error: any) => localize('clusterContextConfigNoLongerValid', "The cluster context information specified by config file: {0} and cluster context: {1} is no longer valid. Error is:\n\t{2}\n Do you want to update this information?", configFile, clusterContext, getErrorMessage(error));
export const invalidConfigPath = localize('arc.invalidConfigPath', "Invalid config path");
export const loadingClusterContextsError = (error: any): string => localize('arc.loadingClusterContextsError', "Error loading cluster contexts. {0}", getErrorMessage(error));

// Upgrade
export const upgradeManagement = localize('arc.upgradeManagement', "Upgrade Management");
export const availableUpgrades = localize('arc.availableUpgrades', "Available Upgrades");
export const availableUpgradesDescription = localize('arc.availableUpgradesDescription', "Available upgrades for this resource are listed below. You can apply upgrades by clicking the upgrade button.");
export const versionLog = localize('arc.versionLog', "Learn more about each release here.");
export const onlyNextImmediateVersion = localize('arc.onlyNextImmediateVersion', "Currently, only upgrading to the next immediate version is supported.");
export const onlyNextImmediateVersionMiaa = localize('arc.onlyNextImmediateVersionMiaa', "The version of a SQL Managed Instance can not be newer than the version of its data controller. Currently, only upgrading to the next immediate version is supported.");
export const version = localize('arc.version', "Version");
export const releaseDate = localize('arc.releaseDate', "Release Date");
export const releaseNotes = localize('arc.releaseNotes', "Release Notes");
export const upgrade = localize('arc.upgrade', "Upgrade");
export const upgradeDataController = localize('arc.upgradeDataController', "Upgrade Data Controller");
export const upgradeMiaa = localize('arc.upgradeMiaa', "Upgrade SQL Managed Instance");
export const areYouSure = localize('arc.areYouSure', "Are you sure you want to apply the selected upgrade?");
export const upgradeDialogController = localize('arc.upgradeDialogController', "During a data controller upgrade, portions of the data control plane such as Custom Resource Definitions (CRDs) and containers may be upgraded. An upgrade of the data controller will not cause downtime for the data services (SQL Managed Instance or PostgreSQL server).");
export const upgradeDialogMiaa = localize('arc.upgradeDialogMiaa', "During a SQL managed instance upgrade, portions of the data control plane such as Custom Resource Definitions (CRDs) and containers may be upgraded. An upgrade of the SQL managed instance will not cause downtime for the data services (SQL Managed Instance or PostgreSQL server).");
export const monitorUpgrade = localize('arc.monitorUpgrade', "You can check the status of the upgrade by running the following command:");
export function errorListingLogAnalyticsWorkspaces(error: any): string { return localize('arc.errorListingLogAnalyticsWorkspaces', "Error listing Log Analytics workspaces {0}", getErrorMessage(error, true)); }
export const noUpgrades = localize('arc.noUpgrades', 'The current version is the latest version. No upgrades available.');
export function upgradingController(param: any): string { return localize('arc.upgradingController', "Data controller is being upgraded. You can check the status of the upgrade by running the following command: 'kubectl get datacontrollers -A'", param); }
export function upgradingMiaa(param: any): string { return localize('arc.upgradingMiaa', "SQL managed instance is being upgraded. You can check the status of the upgrade by running the following command: 'kubectl get sqlmi -A'", param); }
export const currentVersion = localize('arc.currentVersion', "Current version");
export const showMiaaError = localize('arc.showMiaaError', "Error showing details of SQL managed instance.");
export const miaaVersionError = localize('arc.miaaVersionError', "Error getting SQL managed instance version number.");
export const errorGettingConnectionMode = localize('arc.errorGettingConnectionMode', "Error getting data controller connection mode.");
