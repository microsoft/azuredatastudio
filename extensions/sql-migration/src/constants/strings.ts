/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { EOL } from 'os';
import { MigrationSourceAuthenticationType } from '../models/stateMachine';
import { BackupTypeCodes, formatNumber, InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes, InternalManagedDatabaseRestoreDetailsStatusCodes, ParallelCopyTypeCodes, PipelineStatusCodes } from './helper';
import { ValidationError } from '../api/azure';
import { AzureManagedDiskType, ErrorModel } from '../service/contracts';
import { IntegrationRuntimeVersionInfo } from '../api/sqlUtils';
const localize = nls.loadMessageBundle();

export const serviceName = 'Sql Migration Service';
export const providerId = 'SqlMigration';
export const extensionConfigSectionName = 'sqlMigration';
export const sqlConfigSectionName = 'sql';
export const configLogDebugInfo = 'logDebugInfo';
export const importAssessmentKey = "ImportAssessment";
export function serviceCrashMessage(error: string): string {
	return localize('serviceCrashMessage', "Migration service component could not start. {0}", error);
}
export const serviceCrashed = localize('serviceCrashed', "Service component crashed.");
export function waitingForService(serviceName: string): string {
	return localize('waitingForService', "Waiting for {0} component to start.", serviceName);
}
export const serviceProviderInitializationError = localize('serviceProviderIntializationError', "Service provider could not be initialized.");

// mirrors MigrationState as defined in RP
export enum MigrationState {
	Canceled = 'Canceled',
	Canceling = 'Canceling',
	Completing = 'Completing',
	Creating = 'Creating',
	Failed = 'Failed',
	InProgress = 'InProgress',
	ReadyForCutover = 'ReadyForCutover',
	Restoring = 'Restoring',
	Retriable = 'Retriable',
	Succeeded = 'Succeeded',
	UploadingFullBackup = 'UploadingFullBackup',
	UploadingLogBackup = 'UploadingLogBackup',
	CollectionCompleted = 'CollectionCompleted',
	GeneratingScript = 'GeneratingScript',
	PrefetchObjects = 'PrefetchObjects',
	GetDependency = 'GetDependency',
	ScriptObjects = 'ScriptObjects',
	ScriptViewIndexes = 'ScriptViewIndexes',
	ScriptOwnership = 'ScriptOwnership',
	GeneratingScriptCompleted = 'GeneratingScriptCompleted',
	DeployingSchema = 'DeployingSchema',
	DeploymentCompleted = 'DeploymentCompleted',
	Completed = 'Completed',
	CompletedWithError = 'CompletedWithError',
}

export enum ProvisioningState {
	Failed = 'Failed',
	Succeeded = 'Succeeded',
	Creating = 'Creating'
}

export enum BackupFileInfoStatus {
	Arrived = 'Arrived',
	Uploading = 'Uploading',
	Uploaded = 'Uploaded',
	Restoring = 'Restoring',
	Restored = 'Restored',
	Cancelled = 'Cancelled',
	Ignored = 'Ignored'
}

// #region wizard
export function WIZARD_TITLE(instanceName: string): string {
	return localize('sql-migration.wizard.title', "Migrate '{0}' to Azure SQL", instanceName);
}
// //#endregion

// Save and close
export const SAVE_AND_CLOSE = localize('sql.migration.save.close', "Save and close");
export const SAVE_AND_CLOSE_POPUP = localize('sql.migration.save.close.popup', "Configuration saved. Performance data collection will remain running in the background. You can stop the collection when you want to.");
export const RESUME_TITLE = localize('sql.migration.resume.title', "Run migration workflow again");
export const START_NEW_SESSION = localize('sql.migration.start.session', "Start a new session");
export const RESUME_SESSION = localize('sql.migration.resume.session', "Resume previously saved session");
export const OPEN_SAVED_INFO_ERROR = localize("sql.migration.invalid.savedInfo", 'Cannot retrieve saved session. Try again by selecting new session.');
export const RUN_VALIDATION = localize('sql.migration.run.validation', "Run validation");

// Databases for assessment
export const DATABASE_FOR_ASSESSMENT_PAGE_TITLE = localize('sql.migration.database.assessment.title', "Databases for assessment");
export const DATABASE_FOR_ASSESSMENT_DESCRIPTION = localize('sql.migration.database.assessment.description', "Select the databases that you want to assess for migration to Azure SQL.");

// XEvents assessment
export const XEVENTS_ASSESSMENT_TITLE = localize('sql.migration.database.assessment.xevents.title', "Assess Ad-hoc or dynamic SQL");
export const XEVENTS_ASSESSMENT_DESCRIPTION = localize('sql.migration.database.assessment.xevents.description', "For the selected databases, optionally provide extended event session files to assess ad-hoc or dynamic SQL queries or any DML statements initiated through the application data layer.");
export const XEVENTS_ASSESSMENT_HELPLINK = localize('sql.migration.database.assessment.xevents.link', "Learn more");
export const XEVENTS_ASSESSMENT_OPEN_FOLDER = localize('sql.migration.database.assessment.xevents.instructions', "Select a folder where extended events session files (.xel and .xem) are stored");
export const QDS_ASSESSMENT_LABEL = localize('sql.migration.database.assessment.qds.label', "Using Query Data Store (this option is available for Microsoft SQL Server 2016 and later)");
export const XEVENTS_LABEL = localize('sql.migration.database.assessment.xevents.label', "Using extended event session");

// Assessment results
export const ASSESSMENT_RESULTS_PAGE_TITLE = localize('sql.migration.assessment.results.title', "Target platform & assessment results");
export const ASSESSMENT_RESULTS_SUMMARY_LABEL_CAPS = localize('sql.migration.assessment.results.summary.label.caps', "ASSESSMENT RESULTS");
export const ASSESSMENT_RESULTS_PAGE_HEADER = localize('sql.migration.assessment.results.header', "Choose target platform, view assessment results and select database(s) for migration.");
export const IMPORT_ASSESSMENT_PAGE_HEADER = localize('sql.migration.import.assessment.header', "Choose target platform and view assessment results.");
export const ASSESSMENT_RESULTS_SUMMARY_LABEL_DESCRIPTION = localize('sql.migration.assessment.results.summary.label.description', "Assessment results shows the migration readiness of the database(s)");
export const DATABASES_ASSESSED_LABEL = localize('sql.migration.database.assessed.label', "Database(s) assessed");
export const MIGRATION_TIME_LABEL = localize('sql.migration.migration.time.label', "Ready for migration");
export const ASSESSMENT_FINDINGS_LABEL = localize('sql.migration.assessment.findings.label', "Assessment findings");
export const MIGRATION_READINESS_LABEL = localize('sql.migration.migration.readiness.label', "Migration readiness");
export const SUMMARY_TITLE = localize('sql.migration.summary.title', "Summary");
export const DETAILS_TITLE = localize('sql.migration.details.title', "Details");
export const ASSESSMENT_SUMMARY_TITLE = localize('sql.migration.assessment.summary.title', "Assessment summary");
export const READINESS_SECTION_TITLE = localize('sql.migration.readiness.section.title', "Migration readiness of assessed databases in the server instance");
export function TOTAL_FINDINGS_LABEL(findingsCount: number) { return localize('sql.migration.total.findings.label', "Total findings: {0}", findingsCount) }
export const ISSUES_LABEL = localize('sql.migration.issues.label', "Blocking issues");
export const INSTANCE_FINDING_SUMMARY = localize('sql.migration.instance.finding.summary', "Server instance assessment findings summary");
export const SEVERITY_FINDINGS_LABEL = localize('sql.migration.severity.findings.label', "Findings by severity");
export function ASSESSED_DBS_LABEL(databasesCount: number) { return localize('sql.migration.assessed.dbs.label', "Assessed databases: {0}", databasesCount) }
export const NOT_READY = localize('sql.migration.not.ready', "Not ready");
export const READY = localize('sql.migration.ready', "Ready");
export const NEEDS_REVIEW = localize('sql.migration.needs.review', "Needs review");
export const READY_WARN = localize('sql.migration.ready.warn', "Ready with warnings");
export const BLOCKERS = localize('sql.migration.ready', "Blockers");
export const DATABASE_ISSUES_SUMMARY = localize('sql.migration.database.issues.summary', "Database assessment issues summary");
export function TOTAL_ISSUES_LABEL(issuesCount: number) { return localize('sql.migration.total.issues.label', "Total issues found: {0}", issuesCount) }
export const SEVERITY_ISSUES_LABEL = localize('sql.migration.severity.issues.label', "Issues by severity");
export function DB_READINESS_SECTION_TITLE(dbName: string) {
	return localize('sql.migration.db.readiness.section.title', "Database {0} migration readiness", dbName);
}
export function NON_READINESS_DESCRIPTION(issueCount: number) {
	return localize('sql.migration.non.readiness.description', "The database is not ready to migrate due to {0} blocking issue(s).", issueCount);
}
export function WARNING_READINESS_DESCRIPTION(warnings: number) {
	return localize('sql.migration.non.readiness.description', "The database is ready to migrate with {0} warnings.", warnings);
}
export const READINESS_DESCRIPTION = localize('sql.migration.readiness.description', "The database is ready to migrate.");
export const SELECT_TARGET_LABEL = localize('sql.migration.no.target.selected.label', 'Select target type');
export const NO_TARGET_SELECTED_LABEL = localize('sql.migration.select.target.label', 'No target selected. Select target to view the assessment summary.');
export const FINDINGS_LABEL = localize('sql.migration.findings.label', "Findings");
export const ENCRYPTION_LABEL = localize('sql.migration.encryption.label', "Encryption");
export const ENCRYPTION_DESCRIPTION = localize('sql.migration.encryption.description', "This database is encrypted using Transparent Data Encryption (TDE). You need to migrate certificates before you can migrate this database.");

// Assessment results and recommendations
export const ASSESSMENT_SUMMARY_AND_RECOMMENDATIONS_PAGE_TITLE = localize('sql.migration.assessment.summary.and.recommendations.title', "Assessment summary and SKU recommendations");
export const ASSESSMENT_BLOCKING_ISSUE_TITLE = localize('sql.migration.assessments.blocking.issue', 'This is a blocking issue that will prevent the database migration from succeeding.');
export const ASSESSMENT_IN_PROGRESS = localize('sql.migration.assessment.in.progress', "Assessment in progress");
export function ASSESSMENT_IN_PROGRESS_CONTENT(dbName: string) {
	return localize('sql.migration.assessment.in.progress.content', "We are assessing the databases in your SQL Server instance {0} to identify the right Azure SQL target.\n\nThis may take some time.", dbName);
}

export const SKU_RECOMMENDATION_ALL_SUCCESSFUL = (databaseCount: number): string => {
	return localize('sql.migration.wizard.sku.all', "Based on the assessment results, all {0} of your databases in an online state can be migrated to Azure SQL.", databaseCount);
};
export const SKU_RECOMMENDATION_ERROR = (serverName: string): string => {
	return localize('sql.migration.wizard.sku.error', "An error occurred while generating SKU recommendations for the server '{0}'.", serverName);
};
export const SKU_RECOMMENDATION_NO_RECOMMENDATION = localize('sql.migration.wizard.sku.error.noRecommendation', 'No recommendation available');
export const SKU_RECOMMENDATION_NO_RECOMMENDATION_REASON = localize('sql.migration.wizard.sku.error.noRecommendation.reason', 'No SKU recommendations were generated, as there were no SKUs which could satisfy the performance characteristics of your source. Try selecting a different target platform, adjusting recommendation parameters, selecting a different set of databases to assess, or changing the recommendation model.');
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR = (serverName: string): string => {
	return localize('sql.migration.wizard.sku.assessment.error', "An error occurred while assessing the server '{0}'.", serverName);
};
export const SKU_RECOMMENDATION_ASSESSMENT_UNEXPECTED_ERROR = (serverName: string, error: Error): string => {
	return localize(
		'sql.migration.wizard.sku.assessment.unexpected.error',
		"An unexpected error occurred while assessing the server '{0}'.{3}Message: {1}{3}stack: {2}",
		serverName,
		error.message,
		error.stack,
		EOL);
};
export const SKU_RECOMMENDATION_ERROR_MESSAGE = (error: Error): string => {
	return localize(
		'sql.migration.wizard.sku.error.message',
		"message: {0}", error.message);
};
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR_WITH_STACK = (error: Error): string => {
	return localize(
		'sql.migration.wizard.sku.assessment.error.with.stack',
		"message: {0}{1}stack: {2}", error.message, EOL, error.stack);
};
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR_WITH_INFO = (error: ErrorModel): string => {
	return localize(
		'sql.migration.wizard.sku.assessment.error.with.info',
		"message: {0}{1}errorSummary: {2}{3}possibleCauses: {4}}{5}guidance: {6}{7}errorId: {8}",
		error.message, EOL, error.errorSummary, EOL, error.possibleCauses, EOL, error.guidance, EOL, error.errorId);
};
export const PERF_DATA_COLLECTION_ERROR = (serverName: string, errors: string[]): string => {
	return localize('sql.migration.wizard.perfCollection.error', "Error(s) occurred while collecting performance data for the server '{0}'. If these issues persist, try restarting the data collection process:\n\n{1}", serverName, errors.join('\n'));
};
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR_BYPASS = localize('sql.migration.wizard.sku.assessment.error.bypass', 'Check this option to skip assessment and continue the migration.');
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR_DETAIL = localize('sql.migration.wizard.sku.assessment.error.detail', '[There are no assessment results to validate readiness of your database migration. By checking this box, you acknowledge you want to proceed migrating your database to the desired Azure SQL target.]',);
export const AZURE_SQL_MI_DB_COUNT_THRESHOLD_EXCEEDS_ERROR = (selectedDbCount: number): string => {
	return localize('sql.migration.select.azure.mi.db.count.threshold.exceeds.error', 'Error: Azure SQL Managed Instance supports maximum {0} user databases per instance. Select {0} or less database(s) to proceed further.', selectedDbCount);
};
export const AZURE_SQL_MI_DB_COUNT_UNDER_THRESHOLD = localize('sql.migration.select.azure.mi.db.count.under.threshold', 'To proceed, press Select button');
export const ASSESSMENT_SUMMARY_AND_SKU_RECOMMENDATION_FOR_TARGETS_LABEL = localize('sql.migration.wizard.assessment.summary.and.sku.for.targets.label', "View assessment summary and SKU recommendations for Azure SQL targets");

export const SKU_RECOMMENDATION_MI_CARD_TEXT = localize('sql.migration.sku.mi.card.title', "Azure SQL Managed Instance (PaaS)");
export const SKU_RECOMMENDATION_SQLDB_CARD_TEXT = localize('sql.migration.sku.sqldb.card.title', "Azure SQL Database (PaaS)");
export const SKU_RECOMMENDATION_VM_CARD_TEXT = localize('sql.migration.sku.vm.card.title', "SQL Server on Azure Virtual Machine (IaaS)");
export const SKU_RECOMMENDATION_MI_TARGET_TEXT = localize('sql.migration.sku.mi.target.title', "Azure SQL Managed Instance");
export const SKU_RECOMMENDATION_SQLDB_TARGET_TEXT = localize('sql.migration.sku.sqldb.target.title', "Azure SQL Database");
export const SKU_RECOMMENDATION_VM_TARGET_TEXT = localize('sql.migration.sku.vm.target.title', "SQL Server on Azure Virtual Machine");
export const SELECT_AZURE_MI = localize('sql.migration.select.azure.mi', "Select your target Azure subscription and your target Azure SQL Managed Instance.");
export const SELECT_AZURE_VM = localize('sql.migration.select.azure.vm', "Select your target Azure Subscription and your target SQL Server on Azure Virtual Machine for your target.");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI = localize('sql.migration.sku.recommendation.view.assessment.mi', "To migrate to Azure SQL Managed Instance, view assessment results and select one or more databases.");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_VM = localize('sql.migration.sku.recommendation.view.assessment.vm', "To migrate to SQL Server on Azure Virtual Machine, view assessment results and select one or more databases.");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_SQLDB = localize('sql.migration.sku.recommendation.view.assessment.sqldb', "To migrate to Azure SQL Database, view assessment results and select one or more databases.");
export const VIEW_SELECT_BUTTON_LABEL = localize('sql.migration.view.select.button.label', "View/Select");
export function TOTAL_DATABASES_SELECTED(selectedDbCount: number, totalDbCount: number): string {
	return localize('total.databases.selected', "{0} of {1} databases selected", selectedDbCount, totalDbCount);
}
export const SELECT_SKIP_ASSESSMENT_CHECK_TO_CONTINUE = localize('sql.migration.select.skip.assessment.check.to.continue', "To continue, check skip assessment option.");
export const SELECT_TARGET_TO_CONTINUE = localize('sql.migration.select.target.to.continue', "To continue, select a target.");
export const SELECT_DATABASE_TO_MIGRATE = localize('sql.migration.select.database.to.migrate', "Select the databases to migrate.");
export const ASSESSMENT_COMPLETED = (serverName: string): string => {
	return localize('sql.migration.generic.congratulations', "We have completed the assessment of your SQL Server instance '{0}'.", serverName);
};
export const ASSESSMENT_FAILED = (serverName: string): string => {
	return localize('sql.migration.assessment.failed', "The assessment of your SQL Server instance '{0}' failed.", serverName);
};
export function ASSESSMENT_TITLE(serverName: string): string {
	return localize('sql.migration.assessment', "Assessment results for '{0}'", serverName);
}
export function CAN_BE_MIGRATED(eligibleDbs: number, totalDbs: number): string {
	return localize('sql.migration.can.be.migrated', "{0}/{1} databases can be migrated without issues", eligibleDbs, totalDbs);
}

export const ASSESSMENT_MIGRATION_WARNING = localize('sql.migration.assessment.migration.warning', "Databases that are not ready for migration to Azure SQL Managed Instance or Azure SQL Database can be migrated to SQL Server on Azure Virtual Machines.");
export const ASSESSMENT_MIGRATION_WARNING_SQLDB = localize('sql.migration.assessment.migration.warning.sqldb', "Databases that are not ready for migration to Azure SQL Database can be migrated to SQL Server on Azure Virtual Machines. Alternatively, review assessment results for Azure SQL Managed Instance migration readiness.");
export const ASSESSMENT_MIGRATION_WARNING_SQLMI = localize('sql.migration.assessment.migration.warning.sqlmi', "Databases that are not ready for migration to Azure SQL Managed Instance can be migrated to SQL Server on Azure Virtual Machines. Alternatively, review assessment results for Azure SQL Database migration readiness.");
export const DATABASES_TABLE_TILE = localize('sql.migration.databases.table.title', "Databases");
export const SQL_SERVER_INSTANCE = localize('sql.migration.sql.server.instance', "SQL Server instance");
export const LOAD_ASSESSMENT_REPORT = localize('sql.migration.load.assessment.report', "Load assessment report");
export const SAVE_ASSESSMENT_REPORT = localize('sql.migration.save.assessment.report', "Save assessment report");
export const SAVE_RECOMMENDATION_REPORT = localize('sql.migration.save.recommendation.report', "Save recommendation report");
export function SAVE_ASSESSMENT_REPORT_SUCCESS(filePath: string): string {
	return localize('sql.migration.save.assessment.report.success', "Successfully saved assessment report to {0}.", filePath);
}
export function SAVE_RECOMMENDATION_REPORT_SUCCESS(filePath: string): string {
	return localize('sql.migration.save.recommendation.report.success', "Successfully saved recommendation report to {0}.", filePath);
}

// SKU
export const AZURE_RECOMMENDATION = localize('sql.migration.sku.recommendation', "Azure recommendation (PREVIEW)");
export function RECOMMENDATIONS_TITLE(targetType: string): string {
	return localize('sql.migration.sku.recommendations.title', "{0} Recommendations", targetType);
}
export const RECOMMENDED_CONFIGURATION = localize('sql.migration.sku.recommendedConfiguration', "Recommended configuration");
export const RECOMMENDED_CONFIGURATION_SUMMARY_LABEL_CAPS = localize('sql.migration.sku.recommended.configuration.summary.label.caps', "RECOMMENDED CONFIGURATION");
export const RECOMMENDED_CONFIGURATION_SUMMARY_LABEL_DESCRIPTION = localize('sql.migration.recommended.configuration.summary.label.description', "Get the right-sized SKU recommendations for Azure SQL Targets.");
export const GET_AZURE_RECOMMENDATION = localize('sql.migration.sku.get.recommendation', "Get Azure recommendation");
export const REFRESH_ASSESSMENT_LABEL = localize('sql.migration.refresh.assessment.label', "Refresh Assessment");
export const REFRESH_SKU_LABEL = localize('sql.migration.refresh.sku.label', "Refresh SKU");
export const START_PERFORMANCE_COLLECTION = localize('sql.migration.sku.start.performance.collection', "Start data collection");
export const STOP_PERFORMANCE_COLLECTION = localize('sql.migration.sku.stop.performance.collection', "Stop data collection");
export const RESTART_PERFORMANCE_COLLECTION = localize('sql.migration.sku.restart.performance.collection', "Restart data collection");
export const IMPORT_PERFORMANCE_DATA = localize('sql.migration.sku.import.performance.data', "Import performance data");
export const IMPORT_PERFORMANCE_DATA_DIALOG_DESCRIPTION = localize('sql.migration.sku.import.performance.data.dialog.description', "Import this data file from an existing folder, if you have already collected it using Data Migration Assistant.");
export const IMPORT_PERFORMANCE_DATA_DIALOG_HELPER_MESSAGE = localize('sql.migration.sku.import.performance.data.dialog.helper.message', "Select a folder on your local drive");
export const IMPORT_PERFORMANCE_DATA_DIALOG_OPEN_FOLDER = localize('sql.migration.sku.import.performance.data.dialog.open.folder', "Select a folder");
export const UPLOAD_TEMPLATE_TO_AZURE = localize('sql.migration.target.upload.to.azure', "Upload to Azure");
export const TARGET_PROVISIONING_TITLE = localize('sql.migration.target.provisioning.title', "Save Template");
export const GENERATE_ARM_TEMPLATE = localize('sql.migration.target.provisioning.generate.template', "Generate Template");
export const CLOSE_DIALOG = localize('sql.migration.target.provisioning.close', "Close");
export const TARGET_PROVISIONING_DESCRIPTION = localize('sql.migration.target.provisioning.description', "Below is the ARM script for the recommended target SKU. You can save the script as template.");

// allow-any-unicode-next-line
export const AZURE_RECOMMENDATION_CARD_NOT_ENABLED = localize('sql.migration.sku.card.azureRecommendation.notEnabled', "Azure recommendation is not available. Click 'Start data collection' button above to get started.");
export const AZURE_RECOMMENDATION_CARD_IN_PROGRESS = localize('sql.migration.sku.card.azureRecommendation.inProgress', "Azure recommendation will be displayed once data collection is complete.");
export const AZURE_RECOMMENDATION_STATUS_NOT_ENABLED = localize('sql.migration.sku.azureRecommendation.status.notEnabled', "Azure recommendation collects and analyzes performance data and then recommends an appropriate sized target in Azure for your workload.");
export const AZURE_RECOMMENDATION_STATUS_IN_PROGRESS = localize('sql.migration.sku.azureRecommendation.status.inProgress', "Data collection is in progress. ");
export const AZURE_RECOMMENDATION_STATUS_REFINING = localize('sql.migration.sku.azureRecommendation.status.refining', "Data collection still in progress. ");
export const AZURE_RECOMMENDATION_STATUS_STOPPED = localize('sql.migration.sku.azureRecommendation.status.stopped', "Data collection for Azure recommendations has been stopped.");
export function AZURE_RECOMMENDATION_STATUS_AUTO_REFRESH_TIMER(mins: number): string {
	return localize('sql.migration.sku.azureRecommendation.status.autoRefreshTimer', "Time before next SKU recommendation update: {0} minute(s).", mins.toFixed(0));
}
export const AZURE_RECOMMENDATION_STATUS_MANUAL_REFRESH_TIMER = localize('sql.migration.sku.azureRecommendation.status.manualRefreshTimer', "Click on 'Refresh SKU' for updated recommendations.");
export const AZURE_RECOMMENDATION_STATUS_DATA_IMPORTED = localize('sql.migration.sku.azureRecommendation.status.imported', "Azure recommendation has been applied using the provided data. Import or collect additional data to refine the recommendation.");
export const AZURE_RECOMMENDATION_TOOLTIP_NOT_STARTED = localize('sql.migration.sku.azureRecommendation.tooltip.notStarted', "Click the button below to import or collect database performance data.");
export const AZURE_RECOMMENDATION_TOOLTIP_IN_PROGRESS = localize('sql.migration.sku.azureRecommendation.tooltip.inProgress', "Running the performance collection for a longer period of time helps ensure a more accurate recommendation.");

export const AZURE_RECOMMENDATION_START = localize('sql.migration.sku.azureRecommendation.start', "Start");
export const AZURE_RECOMMENDATION_START_POPUP = localize('sql.migration.sku.azureRecommendation.start.popup', "Starting performance data collection...");
export const AZURE_RECOMMENDATION_STOP_POPUP = localize('sql.migration.sku.azureRecommendation.stop.popup', "Stopping performance data collection...");
export const AZURE_RECOMMENDATION_DATA_COLLECTION_POPUP_MESSAGE_LABEL = localize('sql.migration.sku.azureRecommendation.data.collection.popup.message.label', "Where do you want to save collected data?");
export const AZURE_RECOMMENDATION_DATA_COLLECTION_DEFAULT_PATH = localize('sql.migration.sku.azureRecommendation.data.collection.default.path', "Default path");
export const AZURE_RECOMMENDATION_DATA_COLLECTION_CHOOSE_PATH = localize('sql.migration.sku.azureRecommendation.data.collection.choose.path', "Choose a path...");

export const AZURE_RECOMMENDATION_DESCRIPTION = localize('sql.migration.sku.azureRecommendation.description', "Azure recommendation requires performance data of SQL server instance to provide target recommendation. Enable performance data collection to receive the target recommendation for the databases you want to migrate. The longer this will be enabled the better the recommendation. You can disable performance data collection at any time.");
export const AZURE_RECOMMENDATION_DESCRIPTION2 = localize('sql.migration.sku.azureRecommendation.description2', "You can also choose to select this data from an existing folder, if you have already collected it previously.");
export const AZURE_RECOMMENDATION_CHOOSE_METHOD = localize('sql.migration.sku.azureRecommendation.chooseMethod.instructions', "Choose how you want to provide performance data");
export const AZURE_RECOMMENDATION_COLLECT_DATA = localize('sql.migration.sku.azureRecommendation.collectData.method', "Collect performance data now");
export const AZURE_RECOMMENDATION_OPEN_EXISTING = localize('sql.migration.sku.azureRecommendation.openExisting.method', "I already have the performance data");
export const AZURE_RECOMMENDATION_COLLECT_DATA_FOLDER = localize('sql.migration.sku.azureRecommendation.collectDataSelectFolder.instructions', "Select a folder on your local drive where performance data will be saved");
export const AZURE_RECOMMENDATION_OPEN_EXISTING_FOLDER = localize('sql.migration.sku.azureRecommendation.openExistingSelectFolder.instructions', "Select a folder on your local drive where previously collected performance data was saved");
export const FOLDER_NAME = localize('sql.migration.azureRecommendation.folder.name', "Folder name");

export const VIEW_DETAILS = localize('sql.migration.sku.viewDetails', "View details");
export function ASSESSED_DBS(totalDbs: number): string {
	return localize('sql.migration.assessed.databases', "(for {0} assessed databases)", totalDbs);
}
export function RECOMMENDATIONS_AVAILABLE(totalDbs: number): string {
	if (totalDbs === 1) {
		return localize('sql.migration.sku.available.recommendations.one', "{0} recommendation available", totalDbs);
	} else {
		return localize('sql.migration.sku.available.recommendations.many', "{0} recommendations available", totalDbs);
	}
}
export const RECOMMENDATIONS = localize('sql.migration.sku.recommendations', "Recommendations");
export const LOADING_RECOMMENDATIONS = localize('sql.migration.sku.recommendations.loading', "Loading...");
export const TARGET_DEPLOYMENT_TYPE = localize('sql.migration.sku.targetDeploymentType', "Target deployment type");
export const AZURE_CONFIGURATION = localize('sql.migration.sku.azureConfiguration', "Azure configuration");
export function VM_CONFIGURATION(vmSize: string, vCPU: number): string {
	return localize('sql.migration.sku.azureConfiguration.vm', "{0} ({1} vCPU)", vmSize, vCPU);
}
export function VM_CONFIGURATION_PREVIEW(dataDisk: string, logDisk: string, temp: string): string {
	return localize('sql.migration.sku.azureConfiguration.vmPreview', "Data: {0}, Log: {1}, tempdb: {2}", dataDisk, logDisk, temp);
}
export function SQLDB_CONFIGURATION(computeTier: string, vCore: number): string {
	return localize('sql.migration.sku.azureConfiguration.sqldb', "{0} - {1} vCore", computeTier, vCore);
}
export function SQLDB_CONFIGURATION_PREVIEW(hardwareType: string, computeTier: string, vCore: number, storage: number): string {
	return localize('sql.migration.sku.azureConfiguration.sqldbPreview', "{0} - {1} - {2} vCore - {3} GB", hardwareType, computeTier, vCore, storage);
}
export function MI_CONFIGURATION(hardwareType: string, computeTier: string, vCore: number): string {
	return localize('sql.migration.sku.azureConfiguration.mi', "{0} - {1} - {2} vCore", hardwareType, computeTier, vCore);
}
export function MI_CONFIGURATION_PREVIEW(hardwareType: string, computeTier: string, vCore: number, storage: number): string {
	return localize('sql.migration.sku.azureConfiguration.miPreview', "{0} - {1} - {2} vCore - {3} GB", hardwareType, computeTier, vCore, storage);
}
export const GENERAL_PURPOSE = localize('sql.migration.sku.azureConfiguration.generalPurpose', "General purpose");
export const BUSINESS_CRITICAL = localize('sql.migration.sku.azureConfiguration.businessCritical', "Business critical");
export const HYPERSCALE = localize('sql.migration.sku.azureConfiguration.hyperscale', "Hyperscale");
export const GEN5 = localize('sql.migration.sku.azureConfiguration.gen5', "Gen5");
export const PREMIUM_SERIES = localize('sql.migration.sku.azureConfiguration.premiumSeries', "Premium-series");
export const PREMIUM_SERIES_MEMORY_OPTIMIZED = localize('sql.migration.sku.azureConfiguration.premiumSeriesMemoryOptimized', "Memory optimized premium-series");

export const RECOMMENDATION_REASON = localize('sql.migration.sku.recommendationReason', "Recommendation reason");
export const SOURCE_PROPERTIES = localize('sql.migration.sku.sourceProperties', "Source properties");

export const SQL_TEMPDB = localize('sql.migration.sku.sql.temp', "SQL tempdb");
export const SQL_DATA_FILES = localize('sql.migration.sku.sql.dataDisk', "SQL data files");
export const SQL_LOG_FILES = localize('sql.migration.sku.sql.logDisk', "SQL log files");
export function STORAGE_CONFIGURATION(count: number, diskConfiguration: string): string {
	return localize('sql.migration.sku.azureConfiguration.storage', "{0} x {1} ", count, diskConfiguration);
}
export function DISK_CONFIGURATION(type: string, maxSizeInGib: number, maxIOPS: number, maxThroughputInMbps: number): string {
	return localize('sql.migration.sku.azureConfiguration.disk', "{0} {1}GB ({2} IOPS, {3} MB/s)", type, maxSizeInGib, maxIOPS, maxThroughputInMbps);
}
export const RECOMMENDED_TARGET_STORAGE_CONFIGURATION = localize('sql.migration.sku.targetStorageConfiguration', "Recommendation target storage configuration");
export const RECOMMENDED_TARGET_STORAGE_CONFIGURATION_INFO = localize('sql.migration.sku.targetStorageConfiguration.info', "Below is the target storage configuration required to meet your storage performance needs.");
export const STORAGE_HEADER = localize('sql.migration.sku.targetStorageConfiguration.storage', "Storage");
export function STORAGE_GB(storage: number): string {
	return localize('sql.migration.sku.storageGB', "{0} GB", storage);
}
export const RECOMMENDED_STORAGE_CONFIGURATION = localize('sql.migration.sku.targetStorageConfiguration.recommendedStorageConfiguration', "Recommended storage configuration");
export const EPHEMERAL_TEMPDB = localize('sql.migration.sku.targetStorageConfiguration.ephemeralTempdb', "Place tempdb on the local ephemeral SSD (default D:\\) drive");
export const LOCAL_SSD = localize('sql.migration.sku.targetStorageConfiguration.local.SSD', "Local SSD");
export const UNKNOWN_DISK_TYPE = localize('sql.migration.sku.targetStorageConfiguration.disktype.unknown', 'Unknown disk type');

export const CACHING = localize('sql.migration.sku.targetStorageConfiguration.caching', "Host caching");
export const CACHING_NA = localize('sql.migration.sku.targetStorageConfiguration.caching.na', "Not applicable");
export const CACHING_NONE = localize('sql.migration.sku.targetStorageConfiguration.caching.none', "None");
export const CACHING_READ_ONLY = localize('sql.migration.sku.targetStorageConfiguration.caching.readOnly', "Read-only");
export const CACHING_READ_WRITE = localize('sql.migration.sku.targetStorageConfiguration.caching.readWrite', "Read/write");

export const DIMENSION = localize('sql.migration.sku.storage.dimension', "Dimension");
export const VALUE = localize('sql.migration.sku.recommended.value', "Value");
export const CPU_REQUIREMENT = localize('sql.migration.sku.cpu.requirement', "CPU requirement");
export const MEMORY_REQUIREMENT = localize('sql.migration.sku.memory.requirement', "Memory requirement");
export const DATA_STORAGE_REQUIREMENT = localize('sql.migration.sku.data.storage.requirement', "Data storage requirement");
export const LOG_STORAGE_REQUIREMENT = localize('sql.migration.sku.log.storage.requirement', "Log storage requirement");
export const DATA_IOPS_REQUIREMENT = localize('sql.migration.sku.data.iops.requirement', "Data IOPS requirement");
export const LOGS_IOPS_REQUIREMENT = localize('sql.migration.sku.logs.iops.requirement', "Logs IOPS requirement");
export const IO_LATENCY_REQUIREMENT = localize('sql.migration.sku.io.memory.requirement', "IO latency requirement");
export function CPU_CORES(cpu: number): string {
	return localize('sql.migration.sku.cpu', "{0} cores", cpu.toFixed(2));
}
export function GB(gb: number): string {
	return localize('sql.migration.sku.gb', "{0} GB", gb.toFixed(2));
}
export function IOPS(iops: number): string {
	return localize('sql.migration.sku.iops', "{0} IOPS", iops.toFixed(2));
}
export function MS(ms: number): string {
	return localize('sql.migration.sku.ms', "{0} ms", ms.toFixed(2));
}

export const RECOMMENDATION_PARAMETERS = localize('sql.migration.sku.parameters', "Recommendation parameters");
export const EDIT_PARAMETERS = localize('sql.migration.sku.parameters.edit', "Edit parameters");
export const EDIT_RECOMMENDATION_PARAMETERS = localize('sql.migration.sku.parameters.edit.title', "Edit recommendation parameters");
export const EDIT_PARAMETERS_TEXT = localize('sql.migration.sku.parameters.text', "Enter the information below to edit the recommendation parameters.");
export const UPDATE = localize('sql.migration.sku.parameters.update', "Update");
export const ENABLE_PREVIEW_SKU = localize('sql.migration.sku.parameters.enable.preview', "Enable preview features");
export const ENABLE_PREVIEW_SKU_INFO = localize('sql.migration.sku.parameters.enable.preview.info', "Enabling this option will include the latest hardware generations that have significantly improved performance and scalability. These SKUs are currently in Preview and may not yet be available in all regions.");
export const SCALE_FACTOR = localize('sql.migration.sku.parameters.scale.factor', "Scale factor");
export const SCALE_FACTOR_TOOLTIP = localize('sql.migration.sku.parameters.scale.factor.tooltip', "Change scale factor if you want the Azure recommendation to be a percentage larger or smaller than you current workload.");
export const INVALID_SCALE_FACTOR = localize('sql.migration.sku.parameters.scale.factor.invalid', "Invalid scale factor. Enter a positive integer value.");
export const PERCENTAGE_UTILIZATION = localize('sql.migration.sku.parameters.percentage.utilization', "Percentage utilization");
export const PERCENTAGE_UTILIZATION_TOOLTIP = localize('sql.migration.sku.parameters.percentage.utilization.tooltip', "Percentile of data points to be used during aggregation of the performance data.");
export const ELASTIC_RECOMMENDATION_LABEL = localize('sql.migration.sku.parameters.enable.elastic', "Enable elastic recommendation");
export const ELASTIC_RECOMMENDATION_INFO = localize('sql.migration.sku.parameters.enable.elastic.info', "Elastic recommendation uses an alternate recommendation model which utilizes personalized price-performance profiling against existing on-cloud customers.");
export function PERCENTAGE(val: number): string {
	return localize('sql.migration.sku.percentage', "{0}%", val);
}
export function PERCENTILE(val: string): string {
	return localize('sql.migration.sku.percentile', "{0}th percentile", val);
}
export const EMPTY_TIME = localize('sql.migration.sku.recommendations.empty.time', "-");
export function LAST_REFRESHED_TIME(d: string = EMPTY_TIME): string {
	return localize('sql.migration.sku.recommendations.lastRefreshed', "Last refreshed: {0}", d);
}
export function TIME_IN_MINUTES(val: number): number {
	return val * 60000;
}

// Wizard Page Cancellation Dialog
export const CANCEL_FEEDBACK_DIALOG_TITLE = localize('sql.migration.cancel.feedback.dialog.title', "Cancel migration");
export const CANCEL_FEEDBACK_DIALOG_DESCRIPTION = localize('sql.migration.cancel.feedback.dialog.description', "Do you want to cancel migration? Your unsaved changes will be discarded.");
export const CANCEL_FEEDBACK_REASON_CONTAINER_TITLE = localize('sql.migration.cancel.feedback.reason.container.title', "Reason for canceling migration");
export const CANCEL_FEEDBACK_REASON_CONTAINER_DESCRIPTION = localize('sql.migration.cancel.feedback.reason.container.description', "Please take a moment to tell us the reason for canceling the migration. This will help us improve the experience.");
export const CANCEL_FEEDBACK_NO_REASON_SELECTED = localize('sql.migration.cancel.feedback.no.reason.selected', "No reason selected");
export const WIZARD_CANCEL_REASON_OTHERS_INPUT_BOX_NOTE = localize('sql.migration.wizard.cancel.reason.others.input.box.note', "If you selected others, please write a short note.");
export const WIZARD_CANCEL_REASON_CONTINUE_WITH_MIGRATION_LATER = localize('sql.migration.wizard.cancel.reason.continue.with.migration.later', "Continue with migration later");
export const WIZARD_CANCEL_REASON_CHANGE_SOURCE_SQL_SERVER = localize('sql.migration.wizard.cancel.reason.change.source.sql.server', "Need to change source SQL Server");
export const WIZARD_CANCEL_REASON_MIGRATION_TAKING_LONGER = localize('sql.migration.wizard.cancel.reason.migration.taking.longer', "Migration taking longer or having issues");
export const WIZARD_CANCEL_REASON_AZURE_SQL_TARGET_NOT_READY = localize('sql.migration.wizard.cancel.reason.source.azure.sql.target.not.ready', "Azure SQL target not ready");
export const WIZARD_CANCEL_REASON_NEED_TO_ANALYSE_FINDINGS = localize('sql.migration.wizard.cancel.reason.need.to.analyse.findings', "Need to analyse/fix the findings");
export const WIZARD_CANCEL_REASON_NEED_TO_EVALUATE_RCOMMENDED_SKU = localize('sql.migration.wizard.cancel.reason.need.to.evaluate.recommended.sku', "Need to evaluate the recommended SKU");
export const WIZARD_CANCEL_REASON_DMS_SERVICE_OR_IR_NOT_READY = localize('sql.migration.wizard.cancel.reason.dms.service.or.ir.not.ready', "Data Migration Service / IR node not ready");
export const WIZARD_CANCEL_REASON_BACKUP_LOCATION_NOT_READY = localize('sql.migration.wizard.cancel.reason.backup.location.not.ready', "Backup location not ready");
export const WIZARD_CANCEL_REASON_WAITING_FOR_DOWNTIME_WINDOW = localize('sql.migration.wizard.cancel.reason.waiting.for.downtime.window', "Waiting for downtime window");
export const WIZARD_CANCEL_REASON_NEED_TO_REVIEW_TABLE_SELECTION = localize('sql.migration.wizard.cancel.reason.need.to.review.table.selection', "Need to review table selection");
export const WIZARD_CANCEL_REASON_NEED_TO_REVIEW_LOGIN_SELECTION = localize('sql.migration.wizard.cancel.reason.need.to.review.login.selection', "Need to review login selection");

// Login Migrations
export function LOGIN_WIZARD_TITLE(instanceName: string): string {
	return localize('sql-migration.login.wizard.title', "Migrate logins from '{0}' to Azure SQL", instanceName);
}
export const LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_DESCRIPTION = localize('sql.login.migration.wizard.target.description', "Select the target Azure SQL Managed Instance, Azure SQL VM, or Azure SQL database(s) where you want to migrate your logins.");
export const LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_PREVIEW_WARNING = localize('sql.login.migration.wizard.target.data.migration.warning', "Please note that login migration feature is in public preview mode.");
export const LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_DATA_MIGRATION_WARNING = localize('sql.login.migration.wizard.target.data.migration.warning', "We recommend migrating your databases(s) to the Azure SQL target before starting the login migration to avoid failures in the process. Nevertheless, you can run this migration process whenever want you want if your goal is to update the user mapping for recently migrated databases.\n\n If the source and database names are not the same, then it is possible that some permissions may not be applied properly.");
export function LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_PERMISSIONS_WARNING(userName: string, instanceName: string): string {
	if (!userName || !userName.length) {
		return localize('sql.login.migration.wizard.target.permission.warning', "Please ensure that the current user has sysadmin permissions to get all login information for the current instance ({0}).", instanceName);
	}
	return localize('sql.login.migration.wizard.target.permission.warning', "Please ensure that the current user ({0}) has sysadmin permissions to get all login information for the current instance ({1}).", userName, instanceName);
}
export const LOGIN_MIGRATIONS_TARGET_TYPE_SELECTION_TITLE = localize('sql.login.migration.wizard.target.type.title', "Azure SQL target type");
export const LOGIN_MIGRATIONS_MI_TEXT = localize('sql.login.migration.mi.title', "Azure SQL Managed Instance");
export const LOGIN_MIGRATIONS_DB_TEXT = localize('sql.login.migration.db.title', "Azure SQL Database");
export const LOGIN_MIGRATIONS_VM_TEXT = localize('sql.login.migration.vm.title', "SQL Server on Azure Virtual Machine");
export const LOGIN_MIGRATIONS_AZURE_SQL_TARGET_PAGE_TITLE = localize('sql.login.migration.target.title', "Azure SQL target");
export const LOGIN_MIGRATIONS_SELECT_LOGINS_PAGE_TITLE = localize('sql.login.migration.select.page.title', "Select login(s) to migrate");
export const LOGIN_MIGRATIONS_SELECT_LOGINS_WINDOWS_AUTH_WARNING = localize('sql.login.migration.select.logins.windows.auth.warning', "Please note that this wizard does not display windows authentication login types because migrating that type is currently not supported. Capability for migrating windows authentication logins is coming soon.");
export const LOGIN_MIGRATIONS_STATUS_PAGE_TITLE = localize('sql.login.migration.status.page.title', "Migration Status");
export function LOGIN_MIGRATIONS_STATUS_PAGE_DESCRIPTION(numLogins: number, targetType: string, targetName: string): string {
	return localize('sql.login.migration.status.page.description', "Migrating {0} logins to target {1} '{2}'", numLogins, targetType, targetName);
}
export function LOGIN_MIGRATIONS_COMPLETED_STATUS_PAGE_DESCRIPTION(numLogins: number, targetType: string, targetName: string): string {
	return localize('sql.login.migration.status.page.description.completed', "Completed migrating {0} logins to {1} '{2}'", numLogins, targetType, targetName);
}
export function LOGIN_MIGRATIONS_FAILED_STATUS_PAGE_DESCRIPTION(numLogins: number, targetType: string, targetName: string): string {
	return localize('sql.login.migration.status.page.description.failed', "Failed migrating {0} logins to {1} '{2}'", numLogins, targetType, targetName);
}
export const LOGIN_MIGRATIONS_STATUS_PAGE_PREVIOUS_BUTTON_TITLE = localize('sql.login.migration.status.page.previous.button.title', "Previous (Disabled)");
export const LOGIN_MIGRATIONS_STATUS_PAGE_PREVIOUS_BUTTON_ERROR = localize('sql.login.migration.status.page.previous.button.error', "Login migration has already been initiated and going back to prior page is disabled.");
export const LOGIN_MIGRATIONS_GET_LOGINS_QUERY = localize('sql.login.migration.get.logins.query',
	"SELECT sp.name as login, sp.type_desc as login_type, sp.default_database_name, case when sp.is_disabled = 1 then 'Disabled' else 'Enabled' end as status FROM sys.server_principals sp  LEFT JOIN sys.sql_logins sl ON sp.principal_id = sl.principal_id WHERE sp.type NOT IN ('G', 'R') AND sp.type_desc IN ('SQL_LOGIN', 'WINDOWS_LOGIN') ORDER BY sp.name;");
export function LOGIN_MIGRATIONS_GET_LOGINS_ERROR_TITLE(targetType: string): string {
	return localize('sql.migration.wizard.login.error.title', "An error occurred while trying to get {0} login information.", targetType);
}
export function LOGIN_MIGRATIONS_GET_LOGINS_ERROR(message: string): string {
	return localize('sql.migration.wizard.target.login.error', "Error getting login information: {0}", message);
}
export const SELECT_LOGIN_TO_CONTINUE = localize('sql.migration.select.database.to.continue', "Please select 1 or more logins for migration");
export const ENTER_AAD_DOMAIN_NAME = localize('sql.login.migration.enter.AAD.domain.name.to.continue', "Microsoft Entra ID Domain name is required to migrate Windows login. Please enter an AAD Domain Name or deselect windows login(s).");
export const LOGIN_MIGRATE_BUTTON_TEXT = localize('sql.migration.start.login.migration.button', "Migrate");
export function LOGIN_MIGRATIONS_GET_CONNECTION_STRING(dataSource: string, id: string, pass: string): string {
	return localize('sql.login.migration.get.connection.string', "data source={0};initial catalog=master;user id={1};password={2};TrustServerCertificate=True;Integrated Security=false;", dataSource, id, pass);
}
export const LOGIN_MIGRATION_IN_PROGRESS = localize('sql.login.migration.in.progress', "Login migration in progress");
export const LOGIN_MIGRATION_REFRESHING_LOGIN_DATA = localize('sql.login.migration.select.in.progress', "Refreshing login list from source and target");
export function LOGIN_MIGRATION_REFRESH_LOGIN_DATA_SUCCESSFUL(numSourceLogins: number, numTargetLogins: number): string {
	return localize('sql.login.migration.refresh.login.data.successful', "Refreshing login list was successful. Source logins found {0}, Target logins found {1}", numSourceLogins, numTargetLogins);
}
export const LOGIN_MIGRATION_REFRESH_SOURCE_LOGIN_DATA_FAILED = localize('sql.login.migration.refresh.source.login.data.failed', "Refreshing login list from source failed");
export const LOGIN_MIGRATION_REFRESH_TARGET_LOGIN_DATA_FAILED = localize('sql.login.migration.refresh.target.login.data.failed', "Refreshing login list from target failed");
export const STARTING_LOGIN_MIGRATION = localize('sql.migration.starting.login', "Validating and migrating logins are in progress");
export const STARTING_LOGIN_MIGRATION_FAILED = localize('sql.migration.starting.login.failed', "Validating and migrating logins failed");
export const ESTABLISHING_USER_MAPPINGS = localize('sql.login.migration.establish.user.mappings', "Validating and migrating logins completed.\n\nEstablishing user mappings.");
export const ESTABLISHING_USER_MAPPINGS_FAILED = localize('sql.login.migration.establish.user.mappings.failed', "Establishing user mappings failed");
export const MIGRATING_SERVER_ROLES_AND_SET_PERMISSIONS = localize('sql.login.migration.migrate.server.roles.and.set.permissions', "Establishing user mappings completed.\n\nCurrently, migrating server roles, establishing server mappings and setting permissions. This will take some time.");
export const MIGRATING_SERVER_ROLES_AND_SET_PERMISSIONS_FAILED = localize('sql.login.migration.migrate.server.roles.and.set.permissions.failed', "Migrating server roles, establishing server mappings and setting permissions failed.");
export const LOGIN_MIGRATIONS_COMPLETE = localize('sql.login.migration.complete', "Completed migrating logins");
export const LOGIN_MIGRATIONS_FAILED = localize('sql.login.migration.failed', "Migrating logins failed");
export function LOGIN_MIGRATIONS_ERROR(message: string): string {
	return localize('sql.login.migration.error', "Login migration error: {0}", message);
}
export const LOGINS_FOUND = localize('sql.login.migration.logins.found', "Login found");
export const LOGINS_NOT_FOUND = localize('sql.login.migration.logins.not.found', "Login not found");
export const LOGIN_MIGRATION_STATUS_SUCCEEDED = localize('sql.login.migration.status.succeeded', "Succeeded");
export const LOGIN_MIGRATION_STATUS_FAILED = localize('sql.login.migration.status.failed', "Failed");
export const LOGIN_MIGRATION_STATUS_IN_PROGRESS = localize('sql.login.migration.status.in.progress', "In progress");
export const LOGIN_MIGRATIONS_AAD_DOMAIN_NAME_INPUT_BOX_LABEL = localize('sql.login.migration.aad.domain.name.input.box.label', "Microsoft Entra ID Domain Name (only required to migrate Windows Authenication Logins)");
export const LOGIN_MIGRATIONS_AAD_DOMAIN_NAME_INPUT_BOX_PLACEHOLDER = localize('sql.login.migration.aad.domain.name.input.box.placeholder', "Enter AAD Domain Name");
export function LOGIN_MIGRATIONS_LOGIN_STATUS_DETAILS_TITLE(loginName: string): string {
	return localize('sql.login.migration.login.status.details.title', "Migration status details for {0}", loginName);
}
export const NOT_STARTED = localize('sql.login.migration.steps.not.started', "Not started");
export const MIGRATE_LOGINS = localize('sql.login.migration.steps.migrate.logins', "Migrate logins");
export const ESTABLISH_USER_MAPPINGS = localize('sql.login.migration.steps.migrate.logins', "Establish user mappings");
export const MIGRATE_SERVER_ROLES_AND_SET_PERMISSIONS = localize('sql.login.migration.steps.migrate.logins', "Migrate server roles, set login and server permissions");
export const LOGIN_MIGRATION_COMPLETED = localize('sql.login.migration.steps.migrate.logins', "Login migration completed");
export function COLLECTING_TARGET_LOGINS_FAILED(errorCode: number): string {
	return localize('sql.login.migration.collecting.target.logins.failed', "Collecting target login failed with error code {0}", errorCode);
}

// Azure SQL Target
export const AZURE_SQL_TARGET_PAGE_TITLE = localize('sql.migration.wizard.target.title', "Azure SQL target");
export function AZURE_SQL_TARGET_PAGE_DESCRIPTION(targetInstance: string = 'instance'): string {
	return localize('sql.migration.wizard.target.description', "Select an Azure account and your target {0}.", targetInstance);
}

export const AZURE_SQL_TARGET_CONNECTION_ERROR_TITLE = localize('sql.migration.wizard.connection.error.title', "An error occurred while connecting to the target server.");
export function SQL_TARGET_CONNECTION_ERROR(message: string): string {
	return localize('sql.migration.wizard.target.connection.error', "Connection error: {0}", message);
}
export function SQL_TARGET_CONNECTION_SUCCESS(databaseCount: string): string {
	return localize('sql.migration.wizard.target.connection.success', "Connection was successful. Target databases found: {0}", databaseCount);
}

export const SQL_TARGET_MISSING_SOURCE_DATABASES = localize('sql.migration.wizard.source.missing', 'Connection was successful but did not find any target databases.');

export function SQL_TARGET_CONNECTION_SUCCESS_LOGINS(databaseCount: string): string {
	return localize('sql.login.migration.wizard.target.connection.success', "Connection was successful.", databaseCount);
}

export const SQL_TARGET_MAPPING_ERROR_MISSING_TARGET = localize(
	'sql.migration.wizard.target.missing',
	'Database mapping error. Missing target databases to migrate.  Please configure the target server connection and click connect to collect the list of available database migration targets.');

export function SQL_TARGET_CONNECTION_DUPLICATE_TARGET_MAPPING(
	targetDatabaseName: string,
	sourceDatabaseName: string,
	mappedSourceDatabaseName: string,
): string {
	return localize(
		'sql.migration.wizard.target.mapping.error.duplicate',
		"Database mapping error. Target database '{0}' cannot be selected to as a migration target for database '{1}'.  Target database '{2}' is already selected as a migration target for database '{3}'.  Please select a different target database.",
		targetDatabaseName,
		sourceDatabaseName,
		targetDatabaseName,
		mappedSourceDatabaseName);
}

//`Database mapping error.  Source database '${sourceDatabaseName}' is not mapped to a target database.  Please select a target database to migrate to.`
export function SQL_TARGET_CONNECTION_SOURCE_NOT_MAPPED(sourceDatabaseName: string): string {
	return localize(
		'sql.migration.wizard.target.source.mapping.error',
		"Database mapping error. Source database '{0}' is not mapped to a target database.  Please select a target database to migrate to.",
		sourceDatabaseName);
}

//`A mapping error (Error code: {0}) was found between '{1}' and '{2}' databases. The source database collation '{3}' does not match the target database collation '{4}'. Please select or re-create a target database with the same collation as the source database.`
export function SQL_TARGET_SOURCE_COLLATION_NOT_SAME(
	errorCode: string,
	sourceDatabaseName: string,
	targetDatabaseName: string,
	sourceDatabaseCollation: string | undefined,
	targetDatabaseCollation: string | undefined): string {
	return localize(
		'sql.migration.wizard.target.source.collation.error',
		"Database mapping error (Error code: {0}) was found between '{1}' and '{2}' databases. The source database collation '{3}' does not match the target database collation '{4}'. Please select or re-create a target database with the same collation as the source database.",
		errorCode,
		sourceDatabaseName,
		targetDatabaseName,
		sourceDatabaseCollation,
		targetDatabaseCollation);
}

export const SQL_MIGRATION_TROUBLESHOOTING_LINK = localize('sql.migration.wizard.troubleshooting', 'See link for more troubleshooting steps: https://aka.ms/dms-migrations-troubleshooting.');

// Managed Instance
export const AZURE_SQL_DATABASE_MANAGED_INSTANCE = localize('sql.migration.azure.sql.database.managed.instance', "Azure SQL Managed Instance");
export const NO_MANAGED_INSTANCE_FOUND = localize('sql.migration.no.managedInstance.found', "No managed instances found.");
export const INVALID_MANAGED_INSTANCE_ERROR = localize('sql.migration.invalid.managedInstance.error', "To continue, select a valid managed instance.");
export function UNAVAILABLE_TARGET_PREFIX(targetName: string): string {
	return localize('sql.migration.unavailable.target', "(Unavailable) {0}", targetName);
}

// Virtual Machine
export const AZURE_SQL_DATABASE_VIRTUAL_MACHINE = localize('sql.migration.azure.sql.database.virtual.machine', "SQL Server on Azure Virtual Machines");
export const AZURE_SQL_DATABASE_VIRTUAL_MACHINE_SHORT = localize('sql.migration.azure.sql.database.virtual.machine.short', "SQL Server on Azure VM");
export const NO_VIRTUAL_MACHINE_FOUND = localize('sql.migration.no.virtualMachine.found', "No virtual machines found.");
export const INVALID_VIRTUAL_MACHINE_ERROR = localize('sql.migration.invalid.virtualMachine.error', "To continue, select a valid virtual machine.");

// Azure SQL Database
export const AZURE_SQL_DATABASE = localize('sql.migration.azure.sql.database', "Azure SQL Database Server");
export const NO_SQL_DATABASE_SERVER_FOUND = localize('sql.migration.no.sqldatabaseserver.found', "No Azure SQL database servers found.");
export const NO_SQL_DATABASE_FOUND = localize('sql.migration.no.sqldatabase.found', "No Azure SQL databases found.");
export const INVALID_SQL_DATABASE_ERROR = localize('sql.migration.invalid.sqldatabase.error', "To continue, select a valid Azure SQL Database server.");

// Target info tooltip
export const TARGET_SUBSCRIPTION_INFO = localize('sql.migration.sku.subscription', "Subscription name for your Azure SQL target");
export const TARGET_LOCATION_INFO = localize('sql.migration.sku.location', "Azure region for your Azure SQL target. Only regions that contain a target eligible for migration will be shown.");
export const TARGET_RESOURCE_GROUP_INFO = localize('sql.migration.sku.resource_group', "Resource group for your Azure SQL target. Only resource groups that contain a target eligible for migration will be shown.");
export const TARGET_RESOURCE_INFO = localize('sql.migration.sku.resource', "Your Azure SQL target resource name");
export const TARGET_RESOURCE_PORT_INFO = localize('sql.migration.sku.resource.port', "Your Azure SQL target resource port number : 0 - 65535");

// DMS tooltip
export const DMS_SUBSCRIPTION_INFO = localize('sql.migration.dms.subscription', "Subscription name for your Azure Database Migration Service");
export const DMS_LOCATION_INFO = localize('sql.migration.dms.location', "Azure region for your Azure Database Migration Service. Only regions that contain a service will be shown.");
export const DMS_RESOURCE_GROUP_INFO = localize('sql.migration.dms.resource_group', "Resource group for your Azure SQL target. Only resource groups that contain a service will be shown.");
export const DMS_RESOURCE_INFO = localize('sql.migration.dms.resource', "Your Azure Database Migration Service resource name");

// Accounts page
export const ACCOUNTS_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.account.title', "Azure account");
export const ACCOUNTS_SELECTION_PAGE_DESCRIPTION = localize('sql.migration.wizard.account.description', "Select an Azure account linked to Azure Data Studio, or link one now.");
export const ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR = localize('sql.migration.wizard.account.noAccount.error', "Add a linked account and then try again.");
export const ACCOUNT_LINK_BUTTON_LABEL = localize('sql.migration.wizard.account.add.button.label', "Link account");
export const INVALID_ACCOUNT_ERROR = localize('sql.migration.invalid.account.error', "To continue, select a valid Azure account.");

export function accountLinkedMessage(count: number): string {
	return count === 1 ? localize('sql.migration.wizard.account.count.single.message', '{0} account linked', count) : localize('sql.migration.wizard.account.count.multiple.message', '{0} accounts linked', count);
}
export const AZURE_TENANT = localize('sql.migration.azure.tenant', "Microsoft Entra tenant");
export function MI_NOT_READY_ERROR(miName: string, state: string): string {
	return localize('sql.migration.mi.not.ready', "The managed instance '{0}' is unavailable for migration because it is currently in the '{1}' state. To continue, select an available managed instance.", miName, state);
}
export function VM_NOT_READY_IAAS_EXTENSION_ERROR(vmName: string, extensionState: string): string {
	return localize('sql.migration.vm.not.ready.iaas.extension', "The virtual machine '{0}' is unavailable for migration because the SQL Server IaaS Agent extension is currently in '{1}' mode instead of Full mode. Learn more: https://aka.ms/sql-iaas-extension", vmName, extensionState);
}
export function VM_NOT_READY_POWER_STATE_ERROR(vmName: string): string {
	return localize('sql.migration.vm.not.ready.power.state', "The virtual machine '{0}' is unavailable for migration because the underlying virtual machine is not running. Please make sure it is powered on before retrying.", vmName);
}
export function SQLDB_NOT_READY_ERROR(sqldbName: string, state: string): string {
	return localize('sql.migration.sqldb.not.ready', "The SQL database server '{0}' is unavailable for migration because it is currently in the '{1}' state. To continue, select an available SQL database server.", sqldbName, state);
}

export const SELECT_AN_TARGET_TYPE = localize('sql.migration.select.service.select.target.type.', "Select target Azure SQL Type");
export const SELECT_AN_ACCOUNT = localize('sql.migration.select.service.select.a.', "Sign into Azure and select an account");
export const SELECT_A_TENANT = localize('sql.migration.select.service.select.a.tenant', "Select a tenant");
export const SELECT_A_SUBSCRIPTION = localize('sql.migration.select.service.select.a.subscription', "Select a subscription");
export const SELECT_A_LOCATION = localize('sql.migration.select.service.select.a.location', "Select a location");
export const SELECT_A_RESOURCE_GROUP = localize('sql.migration.select.service.select.a.resource.group', "Select a resource group");
export const SELECT_A_SERVICE = localize('sql.migration.select.service.select.a.service', "Select a Database Migration Service");
export const SELECT_ACCOUNT_ERROR = localize('sql.migration.select.service.select.account.error', "An error occurred while loading available Azure accounts.");
export const SELECT_TENANT_ERROR = localize('sql.migration.select.service.select.tenant.error', "An error occurred while loading available Azure account tenants.");
export const SELECT_SUBSCRIPTION_ERROR = localize('sql.migration.select.service.select.subscription.error', "An error occurred while loading account subscriptions. Please check your Azure connection and try again.");
export const SELECT_LOCATION_ERROR = localize('sql.migration.select.service.select.location.error', "An error occurred while loading locations. Please check your Azure connection and try again.");
export const SELECT_RESOURCE_GROUP_ERROR = localize('sql.migration.select.service.select.resource.group.error', "An error occurred while loading available resource groups. Please check your Azure connection and try again.");
export const SELECT_SERVICE_ERROR = localize('sql.migration.select.service.select.service.error', "An error occurred while loading available database migration services. Please check your Azure connection and try again.");
export function ACCOUNT_CREDENTIALS_REFRESH(accountName: string): string {
	return localize(
		'sql.migration.account.credentials.refresh.required',
		"{0} (requires credentials refresh)",
		accountName);
}
export const SELECT_SERVICE_PLACEHOLDER = localize('sql.migration.select.service.select.migration.target', "Select a target server");

// database backup page
export const DATA_SOURCE_CONFIGURATION_PAGE_TITLE = localize('sql.migration.data.source.configuration.page.title', "Data source configuration");
export const DATABASE_BACKUP_PAGE_DESCRIPTION = localize('sql.migration.database.page.description', "Select the location of the database backups to use during migration.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL = localize('sql.migration.nc.network.share.radio.label', "My database backups are on a network share");
export const DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL = localize('sql.migration.nc.blob.storage.radio.label', "My database backups are in an Azure Storage Blob Container");
export const DATABASE_BACKUP_SQL_VM_PAGE_BLOB_INFO = localize('sql.migration.sql.vm.page.blob.info', "For target servers running SQL Server 2014 or below, you must store your database backups in an Azure Storage Blob Container instead of uploading them using the network share option. Additionally, you must store the backup files as page blobs, as block blobs are supported only for targets running SQL Server 2016 or later. Learn more: {0}");
export const DATABASE_BACKUP_SQL_VM_PAGE_BLOB_URL_LABEL = localize('sql.migration.sql.vm.page.blob.url.label', "Known issues, limitations, and troubleshooting");
export const DATABASE_BACKUP_NETWORK_SHARE_HEADER_TEXT = localize('sql.migration.network.share.header.text', "Network share details");
export const DATABASE_BACKUP_NETWORK_SHARE_LOCATION_INFO = localize('sql.migration.network.share.location.info', "Network share path for your database backups. The migration process will automatically retrieve valid backup files from this network share.");
export const DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_INFO = localize('sql.migration.network.share.windows.user.info', "Windows user account with read access to the network share location.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT = localize('sql.migration.network.share.help.text', "Provide the network share location where the backups are stored, and the user credentials used to access the share.");
export const DATABASE_BACKUP_NETWORK_SHARE_TABLE_HELP_TEXT = localize('sql.migration.network.share.storage.table.help', "Enter target database name and network share path information for the selected source databases.");
export const DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL = localize('sql.migration.network.share.location.label', "Network share location where the backups are stored");
export const DATABASE_SERVICE_ACCOUNT_INFO_TEXT = localize('sql.migration.service.account.info.text', "Ensure that the service account running the source SQL Server instance has read privileges on the network share.");
export const DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL = localize('sql.migration.network.share.windows.user.label', "Windows user account with read access to the network share location");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL = localize('sql.migration.network.share.password.label', "Password");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER = localize('sql.migration.network.share.password.placeholder', "Enter password.");
export const DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HEADER = localize('sql.migration.network.share.azure.header', "Storage account details");
export const DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP = localize('sql.migration.network.share.azure.help', "Provide the Azure Storage account where the backups will be uploaded to.");
export const DUPLICATE_NAME_ERROR = localize('sql.migration.unique.name', "Select a unique name for this target database");
export function DATABASE_ALREADY_EXISTS_MI(dbName: string, targetName: string): string {
	return localize('sql.migration.database.already.exists', "Database '{0}' already exists on the target managed instance '{1}'.", dbName, targetName);
}
export const DATABASE_ALREADY_EXISTS_VM_INFO = localize('sql.migration.database.already.exists.vm.info', "Ensure that the provided database name(s) do not already exist on the target SQL Server on Azure Virtual Machine.");
export const DATABASE_BACKUP_BLOB_FOLDER_STRUCTURE_INFO = localize('sql.migration.blob.storage.folder.info', "When uploading database backups to your blob container, ensure that backup files from different databases are stored in separate folders. Only the root of the container and folders at most one level deep are supported.");
export const DATABASE_BACKUP_BLOB_FOLDER_STRUCTURE_WARNING = localize('sql.migration.blob.storage.folder.warning', "There are multiple databases with the same backup location selected. Ensure that backup files from different databases are stored in separate folders.");
export const DATABASE_BACKUP_BLOB_STORAGE_HEADER_TEXT = localize('sql.migration.blob.storage.header.text', "Azure Storage Blob Container details");
export const DATABASE_BACKUP_BLOB_STORAGE_HELP_TEXT = localize('sql.migration.blob.storage.help.text', "Provide the Azure Storage Blob Container that contains the backups.");
export const DATABASE_BACKUP_BLOB_STORAGE_TABLE_HELP_TEXT = localize('sql.migration.blob.storage.table.help', "Enter target database name and select resource group, storage account and container for the selected source databases.");
export const DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL = localize('sql.migration.blob.storage.subscription.label', "Subscription");
export const DATABASE_BACKUP_MIGRATION_MODE_LABEL = localize('sql.migration.database.migration.mode.label', "Migration mode");
export const DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION = localize('sql.migration.database.migration.mode.description', "To migrate to the Azure SQL target, choose a migration mode based on your downtime requirements.");
export const DATABASE_TABLE_SELECTION_LABEL = localize('sql.migration.database.table.selection.label', "Table selection");
export const DATABASE_TABLE_SELECTION_DESCRIPTION = localize('sql.migration.database.table.selection.description', "For each database below, click Edit to select the tables to migrate from source to target. Then, before clicking Next, validate the provided configuration by clicking 'Run validation'.");
export const DATABASE_SCHEMA_MIGRATION_HELP = localize('sql.migration.database.schema.migration.help', "Ensure to migrate the database schema from source to target before starting the migration by using the Database Schema Migration feature ({0}) or {1} or the {2} in Azure Data Studio before selecting the list of tables to migrate.");
export const DATABASE_SCHEMA_MIGRATION_PUBLIC_PREVIEW = localize('sql.migration.database.schema.migration.public.preview', "Public Preview");
export const DATABASE_SCHEMA_MIGRATION_DACPAC_EXTENSION = localize('sql.migration.database.schema.migration.dacpac', "SQL Server dacpac extension");
export const DATABASE_SCHEMA_MIGRATION_PROJECTS_EXTENSION = localize('sql.migration.database.schema.migration.project', "SQL Database Projects extension");

export const DATABASE_TABLE_REFRESH_LABEL = localize('sql.migration.database.table.refresh.label', "Refresh");
export const DATABASE_TABLE_SOURCE_DATABASE_COLUMN_LABEL = localize('sql.migration.database.table.source.column.label', "Source database");
export const DATABASE_TABLE_TARGET_DATABASE_COLUMN_LABEL = localize('sql.migration.database.table.target.column.label', "Target database");
export const DATABASE_TABLE_SELECTED_TABLES_COLUMN_LABEL = localize('sql.migration.database.table.tables.column.label', "Select tables");
export const DATABASE_TABLE_CONNECTION_ERROR = localize('sql.migration.database.connection.error', "An error occurred while connecting to target migration database.");
export function DATABASE_TABLE_CONNECTION_ERROR_MESSAGE(message: string): string {
	return localize('sql.migration.database.connection.error.message', "Connection error:{0} {1}", EOL, message);
}
export const DATABASE_TABLE_DATA_LOADING = localize('sql.migration.database.loading', "Loading database table list..");
export const DATABASE_TABLE_VALIDATE_SELECTION_MESSAGE = localize('sql.migration.database.validate.selection', "Please select target database tables to migrate to.  At least one database with one table is required.");
export const DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL = localize('sql.migration.database.migration.mode.online.label', "Online migration");
export const DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION = localize('sql.migration.database.migration.mode.online.description', "Application downtime is limited to cutover at the end of migration.");
export const DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL = localize('sql.migration.database.migration.mode.offline.label', "Offline migration");
export const DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION = localize('sql.migration.database.migration.mode.offline.description', "Application downtime will start when the migration starts.");
export const NETWORK_SHARE_PATH_FORMAT = localize('sql.migration.network.share.path.format', "\\\\Servername.domainname.com\\Backupfolder");
export const WINDOWS_USER_ACCOUNT = localize('sql.migration.windows.user.account', "Domain\\username");
export const NO_SUBSCRIPTIONS_FOUND = localize('sql.migration.no.subscription.found', "No subscriptions found.");
export const NO_LOCATION_FOUND = localize('sql.migration.no.location.found', "No locations found.");
export const RESOURCE_GROUP_NOT_FOUND = localize('sql.migration.resource.group.not.found', "No resource groups found.");
export const NO_STORAGE_ACCOUNT_FOUND = localize('sql.migration.no.storageAccount.found', "No storage accounts found.");
export const NO_FILESHARES_FOUND = localize('sql.migration.no.fileShares.found', "No file shares found.");
export const NO_BLOBCONTAINERS_FOUND = localize('sql.migration.no.blobContainers.found', "No blob containers found.");
export const NO_BLOBFILES_FOUND = localize('sql.migration.no.blobFiles.found', "No blob files found.");
export const NO_BLOBFOLDERS_FOUND = localize('sql.migration.no.blobFolders.found', "No blob folders found.");
export const INVALID_SUBSCRIPTION_ERROR = localize('sql.migration.invalid.subscription.error', "To continue, select a valid subscription.");
export const INVALID_LOCATION_ERROR = localize('sql.migration.invalid.location.error', "To continue, select a valid location.");
export const INVALID_RESOURCE_GROUP_ERROR = localize('sql.migration.invalid.resourceGroup.error', "To continue, select a valid resource group.");
export const INVALID_STORAGE_ACCOUNT_ERROR = localize('sql.migration.invalid.storageAccount.error', "To continue, select a valid storage account.");
export const MISSING_TARGET_USERNAME_ERROR = localize('sql.migration.missing.targetUserName.error', "To continue, enter a valid target user name.");
export const MISSING_TARGET_PASSWORD_ERROR = localize('sql.migration.missing.targetPassword.error', "To continue, enter a valid target password.");
export function STORAGE_ACCOUNT_CONNECTIVITY_WARNING(targetServer: string, databases: string[], isSqlMiTarget: boolean): string {
	return isSqlMiTarget
		? databases.length === 1
			? localize('sql.migration.storageAccount.warning.many', "Target instance '{0}' may not be able to access storage account '{1}'. Ensure that the subnet of the target instance is whitelisted on the storage account, and if applicable, that the private endpoint is in the same virtual network as the target server.", targetServer, databases[0])
			: localize('sql.migration.storageAccount.warning.one', "Target instance '{0}' may not be able to access storage accounts '{1}'. Ensure that the subnet of the target instance is whitelisted on the storage accounts, and if applicable, that the private endpoints are on the same virtual network as the target server.", targetServer, databases.join("', '"))
		: databases.length === 1
			? localize('sql.migration.storageAccount.warning.vm.many', "Target server '{0}' may not be able to access storage account '{1}'. Ensure that the subnet of the target server is whitelisted on the storage account.", targetServer, databases[0])
			: localize('sql.migration.storageAccount.warning.vm.one', "Target server '{0}' may not be able to access storage accounts '{1}'. Ensure that the subnet of the target server is whitelisted on the storage accounts.", targetServer, databases.join("', '"));
}

export const TARGET_TABLE_NOT_EMPTY = localize('sql.migration.target.table.not.empty', "Target table is not empty.");
export const TARGET_TABLE_MISSING = localize('sql.migration.target.table.missing', "Target table does not exist");
export const TARGET_USERNAME_LABEL = localize('sql.migration.username.label', "Target user name");
export const TARGET_USERNAME_PLACEHOLDER = localize('sql.migration.username.placeholder', "Enter the target user name");
export const TARGET_PASSWORD_LABEL = localize('sql.migration.password.label', "Target password");
export const TARGET_PASSWORD_PLACEHOLDER = localize('sql.migration.password.placeholder', "Enter the target password");
export const TARGET_PORT_LABEL = localize('sql.migration.port.label', "Port");
export const TARGET_PORT_PLACEHOLDER = localize('sql.migration.port.placeholder', "Enter the target port");
export const TARGET_CONNECTION_LABEL = localize('sql.migration.connection.label', "Connect");
export const MAP_SOURCE_TARGET_HEADING = localize('sql.migration.map.target.heading', "Map selected source databases to target databases for migration");
export const MAP_SOURCE_TARGET_DESCRIPTION = localize('sql.migration.map.target.description', "Select the target database where you would like to migrate your source database to.  You can choose a target database for only one source database.");
export const MAP_SOURCE_COLUMN = localize('sql.migration.map.source.column', "Source database");
export const MAP_TARGET_COLUMN = localize('sql.migration.map.target.column', "Target database");
export const MAP_TARGET_PLACEHOLDER = localize('sql.migration.map.target.placeholder', "Select a target database");

export function INVALID_BLOB_RESOURCE_GROUP_ERROR(sourceDb: string): string {
	return localize('sql.migration.invalid.blob.resourceGroup.error', "To continue, select a valid resource group for source database '{0}'.", sourceDb);
}
export function INVALID_BLOB_STORAGE_ACCOUNT_ERROR(sourceDb: string): string {
	return localize('sql.migration.invalid.blob.storageAccount.error', "To continue, select a valid storage account for source database '{0}'.", sourceDb);
}
export function INVALID_BLOB_CONTAINER_ERROR(sourceDb: string): string {
	return localize('sql.migration.invalid.blob.container.error', "To continue, select a valid blob container for source database '{0}'.", sourceDb);
}
export function INVALID_BLOB_LAST_BACKUP_FILE_ERROR(sourceDb: string): string {
	return localize('sql.migration.invalid.blob.lastBackupFile.error', "To continue, select a valid last backup file for source database '{0}'.", sourceDb);
}
export function INVALID_BLOB_LAST_BACKUP_FOLDER_ERROR(sourceDb: string): string {
	return localize('sql.migration.invalid.blob.lastBackupFolder.error', "To continue, select a valid backup folder for source database '{0}'.", sourceDb);
}
export function INVALID_NON_PAGE_BLOB_BACKUP_FILE_ERROR(sourceDb: string): string {
	return localize('sql.migration.invalid.non.page.blob.backupFile.error', "To continue, select a blob container where all the backup files are page blobs for source database '{0}', as block blobs are supported only for targets running SQL Server 2016 or later. Learn more: https://aka.ms/dms-migrations-troubleshooting", sourceDb);
}
export const INVALID_NETWORK_SHARE_LOCATION = localize('sql.migration.invalid.network.share.location', "Invalid network share location format. Example: {0}", NETWORK_SHARE_PATH_FORMAT);
export const INVALID_USER_ACCOUNT = localize('sql.migration.invalid.user.account', "Invalid user account format. Example: {0}", WINDOWS_USER_ACCOUNT);
export const INVALID_TARGET_NAME_ERROR = localize('sql.migration.invalid.target.name.error', "Enter a valid name for the target database.");
export const PROVIDE_UNIQUE_CONTAINERS = localize('sql.migration.provide.unique.containers', "Provide a unique container for each target database. Databases affected: ");
export function SQL_SOURCE_DETAILS(authMethod: MigrationSourceAuthenticationType, serverName: string, isSqlDbScenario: boolean = false): string {
	switch (authMethod) {
		case MigrationSourceAuthenticationType.Integrated:
			return isSqlDbScenario
				? localize('sql.migration.source.details.windowAuth.db', "Enter the Windows Authentication credentials used to connect to SQL Server instance {0}. These credentials will be used to connect to the SQL Server instance from the self-hosted integration runtime.", serverName)
				: localize('sql.migration.source.details.windowAuth.nonDb', "Enter the Windows Authentication credentials used to connect to SQL Server instance {0}. These credentials will be used to connect to the SQL Server instance and identify valid backup files.", serverName);
		case MigrationSourceAuthenticationType.Sql:
			return isSqlDbScenario
				? localize('sql.migration.source.details.sqlAuth.db', "Enter the SQL Authentication credentials used to connect to SQL Server instance {0}. These credentials will be used to connect to the SQL Server instance from the self-hosted integration runtime.", serverName)
				: localize('sql.migration.source.details.sqlAuth.nonDb', "Enter the SQL Authentication credentials used to connect to SQL Server instance {0}. These credentials will be used to connect to the SQL Server instance and identify valid backup files.", serverName);
	}
}
export const SELECT_RESOURCE_GROUP_PROMPT = localize('sql.migration.blob.resourceGroup.select.prompt', "Select a resource group value first.");
export const SELECT_STORAGE_ACCOUNT = localize('sql.migration.blob.storageAccount.select', "Select a storage account value first.");
export const SELECT_BLOB_CONTAINER = localize('sql.migration.blob.container.select', "Select a blob container value first.");


export const MISSING_TABLE_NAME_COLUMN = localize('sql.migration.missing.table.name.column', "Table name");
export function SELECT_DATABASE_TABLES_TITLE(targetDatabaseName: string): string {
	return localize('sql.migration.table.select.label', "Select tables for {0}", targetDatabaseName);
}
export const TABLE_SELECTION_EDIT = localize('sql.migration.table.selection.edit', "Edit");

export function TABLE_SELECTION_COUNT(selectedCount: number, rowCount: number): string {
	return localize('sql.migration.table.selection.count', "{0} of {1}", formatNumber(selectedCount), formatNumber(rowCount));
}
export function TABLE_SELECTED_COUNT(selectedCount: number, rowCount: number): string {
	return localize('sql.migration.table.selected.count', "{0} of {1} tables selected", formatNumber(selectedCount), formatNumber(rowCount));
}
export const SELECT_TABLES_FOR_MIGRATION = localize('sql.migration.select.migration.tables', "Select tables for migration");
export const DATABASE_LOADING_TABLES = localize('sql.migration.database.loading.tables', "Loading tables list...");
export const TABLE_SELECTION_FILTER = localize('sql.migration.table.selection.filter', "Filter tables");
export const TABLE_SELECTION_UPDATE_BUTTON = localize('sql.migration.table.selection.update.button', "Update");
export const TABLE_SELECTION_CANCEL_BUTTON = localize('sql.migration.table.selection.update.cancel', "Cancel");

export const TABLE_SELECTION_TABLENAME_COLUMN = localize('sql.migration.table.selection.tablename.column', "Table name");
export const TABLE_SELECTION_HASROWS_COLUMN = localize('sql.migration.table.selection.status.column', "Has rows");

export const VALIDATION_DIALOG_TITLE = localize('sql.migration.validation.dialog.title', "Running validation");
export const VALIDATION_MESSAGE_SUCCESS = localize('sql.migration.validation.success', "Validation completed successfully.  Please click Next to proceed with the migration.");
export function VALIDATION_MESSAGE_CANCELED_ERRORS(msg: string): string {
	return localize(
		'sql.migration.validation.canceled.errors',
		"Validation was canceled with the following error(s):{0}{1}", EOL, msg);
}
export const VALIDATION_MESSAGE_CANCELED = localize('sql.migration.validation.canceled', "Validation was canceled. Please run and validate the migration settings to continue.");
export const VALIDATION_MESSAGE_NOT_RUN = localize('sql.migration.validation.not.run', "Validation has not been run for the current configuration. Please run and validate the migration settings to continue.");

// integration runtime page
export const SELECT_RESOURCE_GROUP = localize('sql.migration.blob.resourceGroup.select', "Select a resource group.");
export const IR_PAGE_TITLE = localize('sql.migration.ir.page.title', "Azure Database Migration Service");
export const IR_PAGE_DESCRIPTION = localize('sql.migration.ir.page.description', "Azure Database Migration Service orchestrates database migration activities and tracks their progress. You can select an existing Database Migration Service if you have created one previously, or create a new one below.");
export const SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR = localize('sql.migration.ir.page.sql.migration.service.not.found', "No Database Migration Service found. Create a new one.");
export const CREATE_NEW = localize('sql.migration.create.new', "Create new");
export const CREATE_NEW_MIGRATION_SERVICE = localize('sql.migration.create.new.migration.service', "Create new migration service");
export const CREATE_NEW_RESOURCE_GROUP = localize('sql.migration.create.new.resource.group', "Create new resource group");
export const INVALID_SERVICE_ERROR = localize('sql.migration.invalid.migration.service.error', "Select a valid Database Migration Service.");
export const SERVICE_OFFLINE_ERROR = localize('sql.migration.invalid.migration.service.offline.error', "Select a Database Migration Service that is connected to a node.");
export const AUTHENTICATION_KEYS = localize('sql.migration.authentication.types', "Authentication keys");
export function SQL_MIGRATION_SERVICE_DETAILS_HEADER(sqlMigrationServiceName: string) {
	return localize('sql.migration.service.header', "Azure Database Migration Service \"{0}\" details:`", sqlMigrationServiceName);
}
export const DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS = localize('sql.migration.database.migration.service.authentication.keys', "Database Migration Service authentication keys");

// configure IR dialog
export const POWERSHELL_SCRIPT_DESCRIPTION = localize('sql.ir.powershellscript.definition', "Once executed in powershell, the unique script shown below will download, and install the self-hosted integration runtime and register it with the Azure Database Migration Service. You will need to have PowerShell installed on the target machine.");
export const SETUP_LOCAL_IR_DESCRIPTION = localize('sql.ir.local.ir.definition', "I want to setup self-hosted integration runtime on my local machine (Machine where Azure Data Studio is running)");
export const SETUP_REMOTE_IR_DESCRIPTION = localize('sql.ir.local.ir.definition', "I want to setup self-hosted integration runtime on another Windows machine that is not my local machine.");
export const CONFIGURE_POWERSHELL_SCRIPT = localize('sql.ir.configure.powershellscript', "Configure using PowerShell script ");
export const POWERSHELL_SCRIPT = localize('sql.ir.powershellscript', "PowerShell script ");
export const EXECUTE_SCRIPT = localize('sql.ir.powershellscript', "Execute script ");
export const EXECUTING_POWERSHELLSCRIPT = localize('sql.ir.executing.powershellscript', "Execution started and monitor the PowerShell window opened. ");
export const CONFIGURE_MANUALLY = localize('sql.ir.configure.manually', "Configure manually ");
export const NO_NODE_FOUND = localize('sql.ir.no.node.found', "No node found");
export const NODE_NAME = localize('sql.ir.node.name', "Node name");
export const IP_ADDRESS = localize('sql.ir.ip.address', "IP address");
export const IR_VERSION = localize('sql.ir.ir.version', "IR version");
export const IMPORTANT = localize('sql.ir.important', "Important");
export const SAVE_SCRIPT = localize('sql.ir.save.script', "Save script");
export const POWERSHELL_SCRIPT_SAVED = localize('sql.ir.powershell.script.saved', "PowerShell script saved");
export const LOCAL_IR_SETUP_NOTE = localize('sql.ir.local.ir.setup.note', "When you click 'execute script', the PowerShell script below will automatically download self-hosted integration runtime software, install, and register it with your Azure Database Migration Service. To check the connection status of the IR, go back to the previous screen and refresh. ");
export const VERSION_MISMATCH = localize('sql.ir.version.mismatch', "All nodes should be on the same version to be configured");
export const POWERSHELL_PREREQ = localize('sql.ir.powershell.prereq', "Prerequisite: Need PowerShell with execute as admin privileges. ");
export const RECOMMENDED_LINK = localize('sql.ir.recommended.link', "Note: Refer Self-hosted IR recommendations");
export const IR_CONFIG_TYPE = localize('sql.ir.config.type', "IR configuration type");
export const PS_SCRIPT_EXPANDED = localize('sql.ir.ps.script.expanded', "Powershell script expanded");
export const PS_SCRIPT_COLLAPSED = localize('sql.ir.ps.script.collapsed', "Powershell script collapsed");
export const MANUAL_IR_EXPANDED = localize('sql.ir.manual.ir.expanded', "Manual IR configuration expanded");
export const MANUAL_IR_COLLAPSED = localize('sql.ir.manual.ir.collapsed', "Manual IR configuration collapsed");

// create migration service dialog
export const CREATE_MIGRATION_SERVICE_TITLE = localize('sql.migration.services.dialog.title', "Create Azure Database Migration Service");
export const MIGRATION_SERVICE_SUBSCRIPTION_INFO = localize('sql.migration.services.subscription', "Subscription name for your Azure Database Migration Service.");
export const MIGRATION_SERVICE_LOCATION_INFO = localize('sql.migration.services.location', "Azure region for your Azure Database Migration Service. This should be the same region as your target Azure SQL.");
export const MIGRATION_SERVICE_RESOURCE_GROUP_INFO = localize('sql.migration.services.resource.group', "Resource group for your Azure Database Migration Service.");
export const MIGRATION_SERVICE_NAME_INFO = localize('sql.migration.services.name', "Azure Database Migration Service name.");
export const MIGRATION_SERVICE_TARGET_INFO = localize('sql.migration.services.target', "Azure SQL target selected as default.");
export function MIGRATION_SERVICE_DIALOG_DESCRIPTION(networkShareScenario: boolean) {
	return networkShareScenario
		? localize('sql.migration.services.container.description.network', "Enter the information below to add a new Azure Database Migration Service. To register self-hosted integration runtime, select 'My database backups are on a network share' on the previous page.")
		: localize('sql.migration.services.container.description', "Enter the information below to add a new Azure Database Migration Service.");
}
export const LOADING_MIGRATION_SERVICES = localize('sql.migration.service.container.loading.help', "Loading Migration Services");
export const SERVICE_CONTAINER_HEADING = localize('sql.migration.service.container.heading', "Set up integration runtime");
export const SERVICE_CONTAINER_DESCRIPTION1 = localize('sql.migration.service.container.container.description1', "Azure Database Migration Service leverages Azure Data Factory's self-hosted integration runtime to handle connectivity between source and target and upload backups from an on-premises network file share to Azure (if applicable).");
export const IR_CONTAINER_DESCRIPTION = localize('sql.migration.ir.container.description', "Azure Database Migration Service leverages Azure Data Factory's Self-hosted Integration Runtime to upload backups from on-premise network file share to Azure. Based on the selections on the previous page you will need to setup an Self-hosted Integration Runtime.");
export const SERVICE_CONTAINER_DESCRIPTION2 = localize('sql.migration.service.container.container.description2', "Follow the instructions below to set up self-hosted integration runtime.");
export const SERVICE_STEP1 = localize('sql.migration.ir.setup.step1', "Step 1: {0}");
export const SERVICE_STEP1_LINK = localize('sql.migration.option', "Download and install integration runtime");
export const SERVICE_STEP2 = localize('sql.migration.ir.setup.step2', "Step 2: Use the keys below to register your integration runtime");
export function SERVICE_STEP3(testConnectionButton: boolean) {
	return testConnectionButton
		? localize('sql.migration.ir.setup.step3', "Step 3: Click on the 'Test connection' button to check the connection between Azure Database Migration Service and integration runtime")
		: localize('sql.migration.ir.setup.step3.alternate', "Step 3: Click on the Refresh button above to check the connection between Azure Database Migration Service and integration runtime")
}
export const SERVICE_CONNECTION_STATUS = localize('sql.migration.connection.status', "Connection status");
export const SERVICE_KEY1_LABEL = localize('sql.migration.key1.label', "Key 1");
export const SERVICE_KEY2_LABEL = localize('sql.migration.key2.label', "Key 2");
export const SERVICE_KEY1_COPIED_HELP = localize('sql.migration.key1.copied', "Key 1 copied");
export const SERVICE_KEY2_COPIED_HELP = localize('sql.migration.key2.copied', "Key 2 copied");
export const REFRESH_KEY1 = localize('sql.migration.refresh.key1', "Refresh key 1");
export const REFRESH_KEY2 = localize('sql.migration.refresh.key2', "Refresh key 2");
export const COPY_KEY1 = localize('sql.migration.copy.key1', "Copy key 1");
export const COPY_KEY2 = localize('sql.migration.copy.key2', "Copy key 2");
export const AUTH_KEY_COLUMN_HEADER = localize('sql.migration.authKeys.header', "Authentication key");
export function AUTH_KEY_REFRESHED(keyName: string): string {
	return localize('sql.migration.authKeys.refresh.message', "Authentication key '{0}' has been refreshed.", keyName);
}
export function SERVICE_NOT_READY(serviceName: string, instructionsBelow: boolean): string {
	return instructionsBelow
		? localize('sql.migration.service.not.ready.below', "Azure Database Migration Service is not registered. Azure Database Migration Service '{0}' needs to be registered with self-hosted integration runtime on any node.\n\nSee below for registration instructions.", serviceName)
		: localize('sql.migration.service.not.ready', "Azure Database Migration Service is not registered. Azure Database Migration Service '{0}' needs to be registered with self-hosted integration runtime on any node.", serviceName);
}
export function SERVICE_ERROR_NOT_READY(serviceName: string, error: string): string {
	return localize('sql.migration.service.error.not.ready',
		"The following error occurred while retrieving registration information for Azure Database Migration Service '{0}'. Please click refresh and try again. Error: '{1}'.",
		serviceName,
		error);
}
export function SERVICE_READY(serviceName: string, nodes: string, instructionsBelow: boolean): string {
	return instructionsBelow
		? localize('sql.migration.service.ready.below', "Azure Database Migration Service '{0}' is connected to self-hosted integration runtime running on node(s) - {1}\n\nFor improved performance and high availability, you can register additional nodes. See below for registration instructions.", serviceName, nodes)
		: localize('sql.migration.service.ready', "Azure Database Migration Service '{0}' is connected to self-hosted integration runtime running on node(s) - {1}\n\nFor improved performance and high availability, you can register additional nodes.", serviceName, nodes);

}
export function SERVICE_READY_WITHOUT_NODENAMES(serviceName: string): string {
	return localize('sql.migration.service.ready.without.nodes',
		"Azure Database Migration Service '{0}' is connected to self-hosted integration runtime running on the following node(s)", serviceName);
}
export const INVALID_SERVICE_NAME_ERROR = localize('sql.migration.invalid.service.name.error', "Enter a valid name for the Migration Service.");
export const SERVICE_NOT_FOUND = localize('sql.migration.service.not.found', "No Migration Services found. To continue, create a new one.");
export const SERVICE_STATUS_REFRESH_ERROR = localize('sql.migration.service.status.refresh.error', 'An error occurred while refreshing the migration service creation status.');
export const OK = localize('sql.migration.ok', "OK");
export function NEW_RESOURCE_GROUP(resourceGroupName: string): string {
	return localize('sql.migration.new.resource.group', "(new) {0}", resourceGroupName);
}
export const TEST_CONNECTION = localize('sql.migration.test.connection', "Test connection");
export const DATA_MIGRATION_SERVICE_CREATED_SUCCESSFULLY = localize('sql.migration.database.migration.service.created.successfully', "Successfully created a Database Migration Service.");
export const DMS_PROVISIONING_FAILED = localize('sql.migration.dms.provision.failed', "Failed to provision a Database Migration Service. Wait a few minutes and then try again.");
export const APPLY = localize('sql.migration.apply', "Apply");
export const CREATING_RESOURCE_GROUP = localize('sql.migration.creating.rg.loading', "Creating resource group");
export const RESOURCE_GROUP_CREATED = localize('sql.migration.rg.created', "Resource group created");
export const RESOURCE_GROUP_DESCRIPTION = localize('sql.migration.resource.group.description', "A resource group is a container that holds related resources for an Azure solution.");
export const NAME_OF_NEW_RESOURCE_GROUP = localize('sql.migration.name.of.new.rg', "Name of new resource group");
export const DATA_UPLOADED_INFO = localize('sql.migration.data.uploaded.info', "Comparison of the actual amount of data read from the source and the actual amount of data uploaded to the target.");
export const COPY_THROUGHPUT_INFO = localize('sql.migration.copy.throughput.info', "Data movement throughput achieved during the migration of your database backups to Azure. This is the rate of data transfer, calculated by data read divided by duration of backups migration to Azure.");
export const SERVICE_SELECTION_LOCATION_MESSAGE = localize('sql.migration.service.selection.location.msg', "Please select the location of your database backup files before continuing.");

// Validate IR dialog
export const VALIDATION_STATE_CANCELED = localize('sql.migration.validation.state.canceled', "Canceled");
export const VALIDATION_STATE_PENDING = localize('sql.migration.validation.state.pending', "Pending");
export const VALIDATION_STATE_RUNNING = localize('sql.migration.validation.state.running', "Running");
export const VALIDATION_STATE_SUCCEEDED = localize('sql.migration.validation.state.succeeded', "Succeeded");
export const VALIDATION_STATE_FAILED = localize('sql.migration.validation.state.failed', "Failed");

export const VALIDATE_IR_DONE_BUTTON = localize('sql.migration.validate.ir.done.button', "Done");
export const VALIDATE_IR_HEADING = localize('sql.migration.validate.ir.heading', "We are validating the following:");
export const VALIDATE_IR_START_VALIDATION = localize('sql.migration.validate.ir.start.validation', "Start validation");
export const VALIDATE_IR_UNSUCCESSFUL_REVALIDATION = localize('sql.migration.validate.ir.unsuccessful.revalidation', "Revalidate unsuccessful steps");
export const VALIDATE_IR_STOP_VALIDATION = localize('sql.migration.validate.ir.stop.validation', "Stop validation");
export const VALIDATE_IR_COPY_RESULTS = localize('sql.migration.validate.ir.copy.results', "Copy validation results");
export const VALIDATE_IR_RESULTS_HEADING = localize('sql.migration.validate.ir.results.heading', "Validation step details");
export const VALIDATE_IR_VALIDATION_COMPLETED = localize('sql.migration.validate.ir.validation.completed', "Validation completed successfully.");
export const VALIDATE_IR_VALIDATION_CANCELED = localize('sql.migration.validate.ir.validation.camceled', "Validation check canceled");

export function VALIDATE_IR_VALIDATION_COMPLETED_ERRORS(msg: string): string {
	return localize(
		'sql.migration.validate.ir.completed.errors',
		"Validation completed with the following error(s):{0}{1}", EOL, msg);
}
export function VALIDATE_IR_VALIDATION_STATUS(state: string | undefined, errors?: string[]): string {
	const status = state ?? '';
	if (errors && errors.length > 0) {
		return localize(
			'sql.migration.validate.ir.status.errors',
			"Validation status: {0}{1}{2}", status, EOL, errors.join(EOL));
	} else {
		return localize(
			'sql.migration.validate.ir.status',
			"Validation status: {0}", status);
	}
}

export const VALIDATE_IR_ERROR_GATEWAY_TIMEOUT = localize('sql.migration.validate.error.gatewaytimeout', "A time-out was encountered while validating a resource connection. Learn more: https://aka.ms/dms-migrations-troubleshooting.");

export function VALIDATE_IR_VALIDATION_STATUS_ERROR_COUNT(state: string | undefined, errorCount: number): string {
	const status = state ?? '';
	return errorCount > 1
		? localize(
			'sql.migration.validate.ir.status.error.count.many',
			"{0} - {1} errors",
			status,
			errorCount)
		: localize(
			'sql.migration.validate.ir.status.error.count.one',
			"{0} - 1 error",
			status);
}

export function VALIDATE_IR_VALIDATION_STATUS_ERROR(state: string | undefined, errors: string[]): string {
	const status = state ?? '';
	return localize(
		'sql.migration.validate.ir.status.error',
		"{0}{1}{2}",
		status,
		EOL,
		errors.join(EOL));
}

export const VALIDATE_IR_COLUMN_VALIDATION_STEPS = localize('sql.migration.validate.ir.column.validation.steps', "Validation steps");
export const VALIDATE_IR_COLUMN_STATUS = localize('sql.migration.validate.ir.column.status', "Status");
export const VALIDATE_IR_VALIDATION_RESULT_LABEL_SHIR = localize('sql.migration.validate.ir.validation.result.label.shir', "Integration runtime connectivity");
export const VALIDATE_IR_VALIDATION_RESULT_LABEL_STORAGE = localize('sql.migration.validate.ir.validation.result.label.storage', "Azure storage connectivity");

export function VALIDATE_IR_VALIDATION_RESULT_LABEL_SOURCE_DATABASE(databaseName: string): string {
	return localize(
		'sql.migration.validate.ir.validation.result.label.source.database',
		"Source database connectivity: '{0}'", databaseName);
}

export function VALIDATE_IR_VALIDATION_RESULT_LABEL_NETWORK_SHARE(shareName: string): string {
	return localize(
		'sql.migration.validate.ir.validation.result.label.networkshare',
		"Network share connectivity: '{0}' ", shareName);
}

export function VALIDATE_IR_VALIDATION_RESULT_LABEL_TARGET_DATABASE(databaseName: string): string {
	return localize(
		'sql.migration.validate.ir.validation.result.label.target.database',
		"Target database connectivity: '{0}'", databaseName);
}

export function VALIDATE_IR_VALIDATION_RESULT_API_ERROR(databaseName: string, error: Error): string {
	return localize(
		'sql.migration.validate.ir.validation.result.api.error',
		"Validation check error{0}Database:{1}{0}Error: {2} - {3}",
		EOL,
		databaseName,
		error.name,
		error.message);
}

export function VALIDATE_IR_VALIDATION_RESULT_ERROR(sourceDatabaseName: string, networkShareLocation: string, error: ValidationError): string {
	return localize(
		'sql.migration.validate.ir.validation.result.error',
		"Validation check error{0}Source database: {1}{0}File share path: {2}{0}Error: {3} - {4}",
		EOL,
		sourceDatabaseName,
		networkShareLocation,
		error.code,
		error.message);
}

export function VALIDATE_IR_SQLDB_VALIDATION_RESULT_ERROR(sourceDatabaseName: string, targetDatabaseName: string, error: ValidationError,): string {
	return localize(
		'sql.migration.validate.ir.sqldb.validation.result.error',
		"Validation check error{0}Source database: {1}{0}Target database: {2}{0}Error: {3} - {4}",
		EOL,
		sourceDatabaseName,
		targetDatabaseName,
		error.code,
		error.message);
}

export const NETWORK_SHARE_USER_ACCOUNT_LABEL = localize('sql.migration.network.share.user.account.label', "User account");
export const NETWORK_SHARE_PASSWORD_LABEL = localize('sql.migration.network.share.password.label', "Password");
export const STORAGE_ACCOUNT_RESOURCE_GROUP_LABEL = localize('sql.migration.storage.account.resource.group.label', "Resource group");
export const STORAGE_ACCOUNT_DETAILS_LABEL = localize('sql.migration.storage.account.details.label', "Storage account");
export function VALIDATION_IR_BUTTON_MISSING_ERROR_MESSAGE(details: string[]): string {
	const missingDetails = details.join(', ');
	return localize(
		'sql.migration.validate.ir.error.message',
		"Details for {0} are mandatory and missing.",
		missingDetails);
}

// common strings
export const WARNING = localize('sql.migration.warning', "Warning");
export const ERROR = localize('sql.migration.error', "Error");
export const LEARN_MORE = localize('sql.migration.learn.more', "Learn more");
export const LEARN_MORE_ABOUT_PRE_REQS = localize('sql.migration.learn.more.prerequisites', "Learn more about things you need before starting a migration.");
export const SUBSCRIPTION = localize('sql.migration.subscription', "Subscription");
export const STORAGE_ACCOUNT = localize('sql.migration.storage.account', "Storage account");
export const RESOURCE_GROUP = localize('sql.migration.resourceGroups', "Resource group");
export const NAME = localize('sql.migration.name', "Name");
export const LOCATION = localize('sql.migration.location', "Location");
export const REFRESH = localize('sql.migration.refresh', "Refresh");
export const CONFIGURE_INTEGRATION_RUNTIME = localize('sql.migration.configure.ir', "Configure Integration Runtime");
export const CREATE = localize('sql.migration.create', "Create");
export const IMPORT = localize('sql.migration.import', "Import");
export const CANCEL = localize('sql.migration.cancel', "Cancel");
export const TYPE = localize('sql.migration.type', "Type");
export const USER_ACCOUNT = localize('sql.migration.path.user.account', "User account");
export const VIEW_ALL = localize('sql.migration.view.all', "All database migrations");
export const TARGET = localize('sql.migration.target', "Target");
export const AZURE_SQL = localize('sql.migration.azure.sql', "Azure SQL");
export const CLOSE = localize('sql.migration.close', "Close");
export const DATA_UPLOADED = localize('sql.migration.data.uploaded.size', "Data uploaded / size");
export const COPY_THROUGHPUT = localize('sql.migration.copy.throughput', "Copy throughput (MBPS)");
export const NEW_SUPPORT_REQUEST = localize('sql.migration.newSupportRequest', "New support request");
export const IMPACT = localize('sql.migration.impact', "Impact");
export const ALL_FIELDS_REQUIRED = localize('sql.migration.all.fields.required', 'All fields are required.');
export const CLEAR = localize('sql.migration.clear', "Clear");
export const SELECT = localize('sql.migration.select', "Select");
export const BROWSE = localize('sql.migration.browse', "Browse");
export const OPEN = localize('sql.migration.open', "Open");

//Summary Page
export const START_MIGRATION_TEXT = localize('sql.migration.start.migration.button', "Start migration");
export const SUMMARY_PAGE_TITLE = localize('sql.migration.summary.page.title', "Summary");
export const SUMMARY_MI_TYPE = localize('sql.migration.summary.mi.type', "Azure SQL Managed Instance");
export const SUMMARY_VM_TYPE = localize('sql.migration.summary.vm.type', "SQL Server on Azure Virtual Machine");
export const SUMMARY_SQLDB_TYPE = localize('sql.migration.summary.sqldb.type', "Azure SQL Database");
export const SUMMARY_DATABASE_COUNT_LABEL = localize('sql.migration.summary.database.count', "Databases for migration");
export const SUMMARY_AZURE_STORAGE_SUBSCRIPTION = localize('sql.migration.summary.azure.storage.subscription', "Azure storage subscription");
export const SUMMARY_AZURE_STORAGE = localize('sql.migration.summary.azure.storage', "Azure storage");
export const NETWORK_SHARE = localize('sql.migration.network.share', "Network share");
export const NETWORK_SHARE_PATH = localize('sql.migration.network.share.path', "Network share path");
export const BLOB_CONTAINER = localize('sql.migration.blob.container.title', "Blob container");
export const BLOB_CONTAINER_LAST_BACKUP_FILE = localize('sql.migration.blob.container.last.backup.file.label', "Last backup file");
export const BLOB_CONTAINER_FOLDER = localize('sql.migration.blob.container.folder.label', "Folder");
export const BLOB_CONTAINER_RESOURCE_GROUP = localize('sql.migration.blob.container.label', "Blob container resource group");
export const BLOB_CONTAINER_STORAGE_ACCOUNT = localize('sql.migration.blob.container.storage.account.label', "Blob container storage account");
export const SOURCE_DATABASES = localize('sql.migration.source.databases', "Source databases");
export const MODE = localize('sql.migration.mode', "Mode");
export const BACKUP_LOCATION = localize('sql.migration.backup.location', "Backup location");
export const AZURE_STORAGE_ACCOUNT_TO_UPLOAD_BACKUPS = localize('sql.migration.azure.storage.account.to.upload.backups', "Azure Storage account to upload backups");
export const SHIR = localize('sql.migration.shir', "Self-hosted integration runtime node");
export const DATABASE_TO_BE_MIGRATED = localize('sql.migration.database.to.be.migrated', "Database to be migrated");
export function COUNT_DATABASES(count: number): string {
	return (count === 1)
		? localize('sql.migration.count.database.single', "{0} database", count)
		: localize('sql.migration.count.database.multiple', "{0} databases", formatNumber(count));
}
export function TOTAL_TABLES_SELECTED(selected: number, total: number): string {
	return localize('total.tables.selected.of.total', "{0} of {1}", formatNumber(selected), formatNumber(total));
}

// Open notebook quick pick string
export const NOTEBOOK_QUICK_PICK_PLACEHOLDER = localize('sql.migration.quick.pick.placeholder', "Select the operation you'd like to perform.");
export const NOTEBOOK_INLINE_MIGRATION_TITLE = localize('sql.migration.inline.migration.notebook.title', "Inline migration");
export const NOTEBOOK_SQL_MIGRATION_ASSESSMENT_TITLE = localize('sql.migration.sql.assessment.notebook.title', "SQL migration assessment");
export const NOTEBOOK_OPEN_ERROR = localize('sql.migration.notebook.open.error', "Failed to open the migration notebook.");

// Dashboard
export const DASHBOARD_REFRESH_MIGRATIONS_TITLE = localize('sql.migration.refresh.migrations.error.title', 'An error has occured while refreshing the migrations list.');
export const DASHBOARD_REFRESH_MIGRATIONS_LABEL = localize('sql.migration.refresh.migrations.error.label', "An error occurred while refreshing the migrations list.  Please check your linked Azure connection and click refresh to try again.");

export const DASHBOARD_TITLE = localize('sql.migration.dashboard.title', "Azure SQL Migration");
export const DASHBOARD_DESCRIPTION = localize('sql.migration.dashboard.description', "Determine the migration readiness of your SQL Server instances, identify a recommended Azure SQL target, and complete the migration of your SQL Server instance to Azure SQL Managed Instance, SQL Server on Azure Virtual Machines or Azure SQL Database.");
export const DASHBOARD_MIGRATE_TASK_BUTTON_TITLE = localize('sql.migration.dashboard.migrate.task.button', "Migrate to Azure SQL");
export const DASHBOARD_MIGRATE_TASK_BUTTON_DESCRIPTION = localize('sql.migration.dashboard.migrate.task.button.description', "Migrate a SQL Server instance to Azure SQL.");
export const DASHBOARD_LOGIN_MIGRATE_TASK_BUTTON_TITLE = localize('sql.migration.dashboard.login.migrate.task.button', "Migrate logins to Azure SQL");
export const DASHBOARD_LOGIN_MIGRATE_TASK_BUTTON_DESCRIPTION = localize('sql.migration.dashboard.login.migrate.task.button.description', "Migrate SQL Server logins to Azure SQL.");
export const DATABASE_MIGRATION_STATUS = localize('sql.migration.database.migration.status', "Database migration status");
export const HELP_TITLE = localize('sql.migration.dashboard.help.title', "Help articles and video links");
export const PRE_REQ_TITLE = localize('sql.migration.pre.req.title', "Things you need before starting your Azure SQL migration:");
export const PRE_REQ_1 = localize('sql.migration.pre.req.1', "An Azure account (not required for assessment or SKU recommendation functionality)");
export const PRE_REQ_2 = localize('sql.migration.pre.req.2', "A source SQL Server database(s) running on on-premises, or on SQL Server on Azure Virtual Machine or any virtual machine running in the cloud (private, public).");
export const PRE_REQ_3 = localize('sql.migration.pre.req.3', "An Azure SQL Managed Instance, SQL Server on Azure Virtual Machine, or Azure SQL Database to migrate your database(s) to.");
export const PRE_REQ_4 = localize('sql.migration.pre.req.4', "Your database backup location details, either a network file share or an Azure Blob Storage container (not required for Azure SQL Database targets).");
export const MIGRATION_IN_PROGRESS = localize('sql.migration.migration.in.progress', "Database migrations in progress");
export const MIGRATION_FAILED = localize('sql.migration.failed', "Database migrations failed");
export const MIGRATION_COMPLETED = localize('sql.migration.migration.completed', "Database migrations completed");
export const MIGRATION_CUTOVER_CARD = localize('sql.migration.cutover.card', "Database migrations completing cutover");
export const SHOW_STATUS = localize('sql.migration.show.status', "Show status");
export function MIGRATION_INPROGRESS_WARNING(count: number) {
	switch (count) {
		case 1:
			return localize('sql.migration.inprogress.warning.single', "{0} database has warnings", count);
		default:
			return localize('sql.migration.inprogress.warning.multiple', "{0} databases have warnings", count);
	}
}
export const FEEDBACK_ISSUE_TITLE = localize('sql.migration.feedback.issue.title', "Feedback on the migration experience");

//Migration cutover dialog
export const BREADCRUMB_MIGRATIONS = localize('sql.migration.details.breadcrumb.migrations', 'Migrations');
export const MIGRATION_CUTOVER = localize('sql.migration.cutover', "Migration cutover");
export const COMPLETE_CUTOVER = localize('sql.migration.complete.cutover', "Complete cutover");
export const SOURCE_DATABASE = localize('sql.migration.source.database', "Source database name");
export const SOURCE_SERVER = localize('sql.migration.source.server', "Source server");
export const SOURCE_VERSION = localize('sql.migration.source.version', "Source version");
export const TARGET_DATABASE_NAME = localize('sql.migration.target.database.name', "Target database name");
export const TARGET_TABLE_COUNT_NAME = localize('sql.migration.target.table.count.name', "Tables selected");
export const TARGET_SERVER = localize('sql.migration.target.server', "Target server");
export const TARGET_VERSION = localize('sql.migration.target.version', "Target version");
export const MIGRATION_STATUS = localize('sql.migration.migration.status', "Migration status");
export const MIGRATION_STATUS_FILTER = localize('sql.migration.migration.status.filter', "Migration status filter");
export const FULL_BACKUP_FILES = localize('sql.migration.full.backup.files', "Full backup file(s)");
export const LAST_APPLIED_LSN = localize('sql.migration.last.applied.lsn', "Last applied LSN");
export const LAST_APPLIED_BACKUP_FILES = localize('sql.migration.last.applied.backup.files', "Last applied backup file(s)");
export const LAST_APPLIED_BACKUP_FILES_TAKEN_ON = localize('sql.migration.last.applied.files.taken.on', "Last applied backup taken on");
export const CURRENTLY_RESTORING_FILE = localize('sql.migration.currently.restoring.file', "Currently restoring file");
export const ALL_BACKUPS_RESTORED = localize('sql.migration.all.backups.restored', "All backups restored");
export const ACTIVE_BACKUP_FILES = localize('sql.migration.active.backup.files', "Active backup files");
export const MIGRATION_STATUS_REFRESH_ERROR = localize('sql.migration.cutover.status.refresh.error', 'An error occurred while refreshing the migration status.');
export const MIGRATION_CANCELLATION_ERROR = localize('sql.migration.cancel.error', 'An error occurred while canceling the migration.');
export const MIGRATION_DELETE_ERROR = localize('sql.migration.delete.error', 'An error occurred while deleting the migration.');

export const FIELD_LABEL_LAST_UPLOADED_FILE = localize('sql.migration.field.label.last.uploaded.file', 'Last uploaded file');
export const FIELD_LABEL_LAST_UPLOADED_FILE_TIME = localize('sql.migration.field.label.last.uloaded.file.time', 'Last uploaded file time');
export const FIELD_LABEL_PENDING_DIFF_BACKUPS = localize('sql.migration.field.label.pending.differential.backups', 'Pending differential backups');
export const FIELD_LABEL_DETECTED_FILES = localize('sql.migration.field.label.deteected.files', 'Detected files');
export const FIELD_LABEL_QUEUED_FILES = localize('sql.migration.field.label.queued.files', 'Queued files');
export const FIELD_LABEL_SKIPPED_FILES = localize('sql.migration.field.label.skipped.files', 'Skipped files');
export const FIELD_LABEL_UNRESTORABLE_FILES = localize('sql.migration.field.label.unrestorable.files', 'Unrestorable files');
export const FIELD_LABEL_LAST_RESTORED_FILE_TIME = localize('sql.migration.field.label.last.restored.file.time', 'Last restored file time');
export const FIELD_LABEL_RESTORED_FILES = localize('sql.migration.field.label.restored.files', 'Restored files');
export const FIELD_LABEL_RESTORING_FILES = localize('sql.migration.field.label.restoring.files', 'Restoring files');
export const FIELD_LABEL_RESTORED_SIZE = localize('sql.migration.field.label.restored.size', 'Restored size (MB)');
export const FIELD_LABEL_RESTORE_PLAN_SIZE = localize('sql.migration.field.label.restore.plan.size', 'Restore plan size (MB)');
export const FIELD_LABEL_RESTORE_PERCENT_COMPLETED = localize('sql.migration.field.label.restore.percent.completed', 'Restore percent completed');
export const FIELD_LABEL_MI_RESTORE_STATE = localize('sql.migration.field.label.mi.restore.state', 'Managed instance restore state');

export const BACKUP_FILE_COLUMN_FILE_NAME = localize('sql.migration.backup.file.name', 'File name');
export const BACKUP_FILE_COLUMN_FILE_STATUS = localize('sql.migration.backup.file.status', 'File status');
export const BACKUP_FILE_COLUMN_RESTORE_STATUS = localize('sql.migration.backup.file.restore.status', 'Restore status');
export const BACKUP_FILE_COLUMN_BACKUP_SIZE_MB = localize('sql.migration.backup.file.backup.size', 'Backup size (MB)');
export const BACKUP_FILE_COLUMN_NUMBER_OF_STRIPES = localize('sql.migration.backup.file.number.of.stripes', 'Number of stripes');
export const BACKUP_FILE_COLUMN_RESTORE_START_DATE = localize('sql.migration.backup.file.restore.start.date', 'Restore start date');
export const BACKUP_FILE_COLUMN_RESTORE_FINISH_DATE = localize('sql.migration.backup.file.restore.finish.date', 'Restore finish date');

export const STATUS = localize('sql.migration.status', "Status");
export const BACKUP_START_TIME = localize('sql.migration.backup.start.time', "Backup start time");
export const FIRST_LSN = localize('sql.migration.first.lsn', "First LSN");
export const LAST_LSN = localize('sql.migration.last.LSN', "Last LSN");
export const CANNOT_START_CUTOVER_ERROR = localize('sql.migration.cannot.start.cutover.error', "The cutover process cannot start until all the migrations are done. To return the latest file status, refresh your browser window.");
export const CANCEL_MIGRATION = localize('sql.migration.cancel.migration', "Cancel migration");
export const DELETE_MIGRATION = localize('sql.migration.delete.migration', "Delete migration");
export function ACTIVE_BACKUP_FILES_ITEMS(fileCount: number) {
	if (fileCount === 1) {
		return localize('sql.migration.active.backup.files.items', "Active backup files (1 item)");
	} else {
		return localize('sql.migration.active.backup.files.multiple.items', "Active backup files ({0} items)", fileCount);
	}
}
export const COPY_MIGRATION_DETAILS = localize('sql.migration.copy.migration.details', "Copy migration details");
export const DETAILS_COPIED = localize('sql.migration.details.copied', "Details copied");
export const CANCEL_MIGRATION_CONFIRMATION = localize('sql.cancel.migration.confirmation', "Are you sure you want to cancel this migration?");
export const DELETE_MIGRATION_CONFIRMATION = localize('sql.delete.migration.confirmation', "Are you sure you want to delete this migration?");

export const RETRY_MIGRATION_TITLE = localize('sql.retry.migration.title', "The migration failed with the following errors:");
export const RETRY_MIGRATION_SUMMARY = localize('sql.retry.migration.summary', "Please resolve any errors before retrying the migration.");
export const RETRY_MIGRATION_PROMPT = localize('sql.retry.migration.prompt', "Do you want to retry the failed table migrations?");

export const YES = localize('sql.migration.yes', "Yes");
export const NO = localize('sql.migration.no', "No");
export const NA = localize('sql.migration.na', "N/A");
export const EMPTY_TABLE_TEXT = localize('sql.migration.empty.table.text', "No backup files");
export const EMPTY_TABLE_SUBTEXT = localize('sql.migration.empty.table.subtext', "If results were expected, verify the connection to the SQL Server instance.");
export const MIGRATION_CUTOVER_ERROR = localize('sql.migration.cutover.error', 'An error occurred while initiating cutover.');
export const REFRESH_BUTTON_TEXT = localize('sql.migration.details.refresh', 'Refresh');
export const SERVER_OBJECTS_FIELD_LABEL = localize('sql.migration.details.serverobjects.field.label', 'Server objects');
export const SERVER_OBJECTS_LABEL = localize('sql.migration.details.serverobjects.label', 'Server objects');
export const SERVER_OBJECTS_ALL_TABLES_LABEL = localize('sql.migration.details.serverobjects.all.tables.label', 'Total tables');
export const SERVER_OBJECTS_IN_PROGRESS_TABLES_LABEL = localize('sql.migration.details.serverobjects.inprogress.tables.label', 'In progress');
export const SERVER_OBJECTS_SUCCESSFUL_TABLES_LABEL = localize('sql.migration.details.serverobjects.successful.tables.label', 'Successful');
export const SERVER_OBJECTS_FAILED_TABLES_LABEL = localize('sql.migration.details.serverobjects.failed.tables.label', 'Failed');
export const SERVER_OBJECTS_CANCELLED_TABLES_LABEL = localize('sql.migration.details.serverobjects.cancelled.tables.label', 'Cancelled');
export const FILTER_SERVER_OBJECTS_PLACEHOLDER = localize('sql.migration.details.serverobjects.filter.label', 'Filter table migration results');
export const FILTER_SERVER_OBJECTS_ARIA_LABEL = localize('sql.migration.details.serverobjects.filter.aria.label', 'Filter table migration results using keywords');

//Migration confirm cutover dialog
export const COMPLETING_CUTOVER_WARNING = localize('sql.migration.completing.cutover.warning', "Completing cutover without restoring all the backups may result in a data loss.");
export const BUSINESS_CRITICAL_INFO = localize('sql.migration.bc.info', "A SQL Managed Instance migration cutover to the Business Critical service tier can take significantly longer than General Purpose because three secondary replicas have to be seeded for Always On High Availability group. The duration of the operation depends on the size of the data. Seeding speed in 90% of cases is 220 GB/hour or higher.");
export const CUTOVER_HELP_MAIN = localize('sql.migration.cutover.help.main', "Perform the following steps before you complete cutover.");
export const CUTOVER_HELP_STEP1 = localize('sql.migration.cutover.step.1', "1. Stop all incoming transactions to the source database.");
export const CUTOVER_HELP_STEP2_NETWORK_SHARE = localize('sql.migration.cutover.step.2.network.share', "2. Create a final transaction log backup and store it on the network share.");
export const CUTOVER_HELP_STEP2_BLOB_CONTAINER = localize('sql.migration.cutover.step.2.blob', "2. Create a final transaction log differential or backup and store it in the Azure Storage Blob Container.");
export const CUTOVER_HELP_STEP3_NETWORK_SHARE = localize('sql.migration.cutover.step.3.network.share', "3. Verify that all log backups have been restored on the target database. The \"Log backups pending restore\" value should be zero.");
export const CUTOVER_HELP_STEP3_BLOB_CONTAINER = localize('sql.migration.cutover.step.3.blob', "3. Verify that all backups have been restored on the target database. The \"Log backups pending restore\" value should be zero.");
export function LAST_FILE_RESTORED(fileName: string): string {
	return localize('sql.migration.cutover.last.file.restored', "Last file restored: {0}", fileName);
}
export function LAST_SCAN_COMPLETED(time: string): string {
	return localize('sql.migration.last.scan.completed', "Last scan completed: {0}", time);
}
export function PENDING_BACKUPS(count: number): string {
	return localize('sql.migration.cutover.pending.backup', "Log backups pending restore: {0}", count);
}
export const CONFIRM_CUTOVER_CHECKBOX = localize('sql.migration.confirm.checkbox.message', "I confirm there are no additional log backups to provide and want to complete cutover.");
export function CUTOVER_IN_PROGRESS(dbName: string): string {
	return localize('sql.migration.cutover.in.progress', "Cutover in progress for database '{0}'", dbName);
}
export const MIGRATION_CANNOT_CANCEL = localize('sql.migration.cannot.cancel', 'Migration is not in progress and cannot be canceled.');
export const MIGRATION_CANNOT_DELETE = localize('sql.migration.cannot.delete', 'Migration is currently in progress and cannot be deleted.');
export const MIGRATION_CANNOT_CUTOVER = localize('sql.migration.cannot.cutover', 'Migration is not in progress and cannot be cutover.');
export const FILE_NAME = localize('sql.migration.file.name', "File name");
export const SIZE_COLUMN_HEADER = localize('sql.migration.size.column.header', "Size");
export const NO_PENDING_BACKUPS = localize('sql.migration.no.pending.backups', "No pending backups. Click refresh to check current status.");

//Migration status dialog
export const ADD_ACCOUNT = localize('sql.migration.status.add.account', "Add account");
export const ADD_ACCOUNT_MESSAGE = localize('sql.migration.status.add.account.MESSAGE', "Add your Azure account to view existing migrations and their status.");
export const SELECT_SERVICE_MESSAGE = localize('sql.migration.status.select.service.MESSAGE', "Select a Database Migration Service to monitor migrations.");
export const STATUS_ALL = localize('sql.migration.status.dropdown.all', "Status: All");
export const STATUS_ONGOING = localize('sql.migration.status.dropdown.ongoing', "Status: Ongoing");
export const STATUS_COMPLETING = localize('sql.migration.status.dropdown.completing', "Status: Completing");
export const STATUS_SUCCEEDED = localize('sql.migration.status.dropdown.succeeded', "Status: Succeeded");
export const STATUS_FAILED = localize('sql.migration.status.dropdown.failed', "Status: Failed");
export const SEARCH_FOR_MIGRATIONS = localize('sql.migration.search.for.migration', "Filter migration results");
export const ONLINE = localize('sql.migration.online', "Online");
export const OFFLINE = localize('sql.migration.offline', "Offline");
export const DATABASE = localize('sql.migration.database', "Database");
export const SRC_DATABASE = localize('sql.migration.src.database', "Source database");
export const SRC_SERVER = localize('sql.migration.src.server', "Source name");
export const SOURCE_LOGIN = localize('sql.migration.source.login', "Source login");
export const LOGIN_TYPE = localize('sql.login.migration.type', "Login type");
export const DEFAULT_DATABASE = localize('sql.migration.default.database', "Default database");
export const LOGIN_STATUS_COLUMN = localize('sql.login.migration.status.column', "Status");
export const LOGIN_TARGET_STATUS_COLUMN = localize('sql.login.migration.target.status.column', "Target Status");
export const LOGIN_MIGRATION_STATUS_COLUMN = localize('sql.login.migration.migration.status.column', "Migration Status");

export const STATUS_COLUMN = localize('sql.migration.database.status.column', "Migration status");
export const DATABASE_MIGRATION_SERVICE = localize('sql.migration.database.migration.service', "Database Migration Service");
export const DURATION = localize('sql.migration.duration', "Duration");
export const AZURE_SQL_TARGET = localize('sql.migration.azure.sql.target', "Target type");
export const SQL_MANAGED_INSTANCE = localize('sql.migration.sql.managed.instance', "SQL Managed Instance");
export const SQL_VIRTUAL_MACHINE = localize('sql.migration.sql.virtual.machine', "SQL Virtual Machine");
export const SQL_DATABASE = localize('sql.migration.sql.database', "SQL Database");
export const TARGET_AZURE_SQL_INSTANCE_NAME = localize('sql.migration.target.azure.sql.instance.name', "Target name");
export const TARGET_SERVER_COLUMN = localize('sql.migration.target.azure.sql.instance.server.name', "Target name");
export const TARGET_DATABASE_COLUMN = localize('sql.migration.target.azure.sql.instance.database.name', "Target database");
export const MIGRATION_MODE = localize('sql.migration.cutover.type', "Migration mode");
export const START_TIME = localize('sql.migration.start.time', "Start time");
export const FINISH_TIME = localize('sql.migration.finish.time', "Finish time");

export const SRC_SERVER_TOOL_TIP = localize('sql.migration.src.server.tool.tip', "Name of the source server");
export const SRC_DATABASE_TOOL_TIP = localize('sql.migration.src.database.tool.tip', "Name of the source database");
export const STATUS_TOOL_TIP = localize('sql.migration.database.status.tool.tip', "The current status of the migration");
export const DURATION_TOOL_TIP = localize('sql.migration.database.migration.duration.tool.tip', "The duration of the migration");
export const AZURE_SQL_TARGET_TOOL_TIP = localize('sql.migration.database.migration.target.type.tool.tip', "The azure resource target type [SQL Managed Instance, SQL Virtual Machine, SQL Database]");
export const TARGET_SERVER_TOOL_TIP = localize('sql.migration.database.migration.target.instance.server.name.tool.tip', "The target server name");
export const TARGET_DATABASE_TOOL_TIP = localize('sql.migration.database.migration.target.instance.database.name.tool.tip', "The target database name");
export const MIGRATION_MODE_TOOL_TIP = localize('sql.migration.database.migration.migration.mode.tool.tip', "In Azure Database Migration Service, you can migrate your databases offline or while they are online. In an offline migration, application downtime starts when the migration starts. To limit downtime to the time it takes you to cut over to the new environment after the migration, use an online migration.");
export const START_TIME_TOOL_TIP = localize('sql.migration.database.migration.start.time.tool.tip', "The start time for the migration");
export const FINISH_TIME_TOOL_TIP = localize('sql.migration.database.migration.finish.time.tool.tip', "The fininish time for the migration");
export const CONTEXT_MENU_TOOL_TIP = localize('sql.migration.database.migration.context.menu.tool.tip', "Click this column to activate the context command menu");

export function STATUS_VALUE(status: string): string {
	return localize('sql.migration.status.value', "{0}", StatusLookup[status] ?? status);
}

export const MIGRATION_ERROR_DETAILS_TITLE = localize('sql.migration.error.details.title', "Migration error details");
export const MIGRATION_ERROR_DETAILS_LABEL = localize('sql.migration.error.details.label', "Migration error(s))");
export const OPEN_MIGRATION_DETAILS_ERROR = localize('sql.migration.open.migration.destails.error', "Error opening migration details dialog");
export const OPEN_MIGRATION_TARGET_ERROR = localize('sql.migration.open.migration.target.error', "Error opening migration target");
export const OPEN_MIGRATION_SERVICE_ERROR = localize('sql.migration.open.migration.service.error', "Error opening migration service dialog");
export const LOAD_MIGRATION_LIST_ERROR = localize('sql.migration.load.migration.list.error', "Error loading migrations list");
export const ERROR_DIALOG_ARIA_CLICK_VIEW_ERROR_DETAILS = localize('sql.migration.error.aria.view.details', 'Click to view error details');

export interface LookupTable<T> {
	[key: string]: T;
}

export const StatusLookup: LookupTable<string | undefined> = {
	[MigrationState.Canceled]: localize('sql.migration.status.canceled', 'Canceled'),
	[MigrationState.Canceling]: localize('sql.migration.status.canceling', 'Canceling'),
	[MigrationState.Completing]: localize('sql.migration.status.completing', 'Completing'),
	[MigrationState.Creating]: localize('sql.migration.status.creating', 'Creating'),
	[MigrationState.Failed]: localize('sql.migration.status.failed', 'Failed'),
	[MigrationState.InProgress]: localize('sql.migration.status.inprogress', 'In progress'),
	[MigrationState.ReadyForCutover]: localize('sql.migration.status.readyforcutover', 'Ready for cutover'),
	[MigrationState.Restoring]: localize('sql.migration.status.restoring', 'Restoring'),
	[MigrationState.Retriable]: localize('sql.migration.status.retriable', 'Retriable'),
	[MigrationState.Succeeded]: localize('sql.migration.status.succeeded', 'Succeeded'),
	[MigrationState.UploadingFullBackup]: localize('sql.migration.status.uploadingfullbackup', 'Uploading full backup'),
	[MigrationState.UploadingLogBackup]: localize('sql.migration.status.uploadinglogbackup', 'Uploading log backup(s)'),
	default: undefined
};

export const PipelineRunStatus: LookupTable<string | undefined> = {
	// status codes: ['PreparingForCopy' | 'Copying' | 'CopyFinished' | 'RebuildingIndexes' | 'Succeeded' | 'Failed' |	'Canceled']
	[PipelineStatusCodes.PreparingForCopy]: localize('sql.migration.copy.status.preparingforcopy', 'Preparing'),
	[PipelineStatusCodes.Copying]: localize('sql.migration.copy.status.copying', 'Copying'),
	[PipelineStatusCodes.CopyFinished]: localize('sql.migration.copy.status.copyfinished', 'Copy finished'),
	[PipelineStatusCodes.RebuildingIndexes]: localize('sql.migration.copy.status.rebuildingindexes', 'Rebuilding indexes'),
	[PipelineStatusCodes.Succeeded]: localize('sql.migration.copy.status.succeeded', 'Succeeded'),
	[PipelineStatusCodes.Failed]: localize('sql.migration.copy.status.failed', 'Failed'),
	[PipelineStatusCodes.Canceled]: localize('sql.migration.copy.status.canceled', 'Canceled'),

	// legacy status codes ['Queued', 'InProgress', 'Cancelled']
	[PipelineStatusCodes.Queued]: localize('sql.migration.copy.status.queued', 'Queued'),
	[PipelineStatusCodes.InProgress]: localize('sql.migration.copy.status.inprogress', 'In progress'),
	[PipelineStatusCodes.Cancelled]: localize('sql.migration.copy.status.cancelled', 'Cancelled'),
};

export const ParallelCopyType: LookupTable<string | undefined> = {
	[ParallelCopyTypeCodes.None]: localize('sql.migration.parallel.copy.type.none', 'None'),
	[ParallelCopyTypeCodes.PhysicalPartitionsOfTable]: localize('sql.migration.parallel.copy.type.physical', 'Physical partitions'),
	[ParallelCopyTypeCodes.DynamicRange]: localize('sql.migration.parallel.copy.type.dynamic', 'Dynamic range'),
};

export const DiskTypeLookup: LookupTable<string | undefined> = {
	[AzureManagedDiskType.StandardHDD]: localize('sql.migration.sku.targetStorageConfiguration.disktype.standardHdd', 'Standard HDD'),
	[AzureManagedDiskType.StandardSSD]: localize('sql.migration.sku.targetStorageConfiguration.disktype.StandardSsd', 'Standard SSD'),
	[AzureManagedDiskType.PremiumSSD]: localize('sql.migration.sku.targetStorageConfiguration.disktype.PremiumSsd', 'Premium SSD'),
	[AzureManagedDiskType.UltraSSD]: localize('sql.migration.sku.targetStorageConfiguration.disktype.UltraSsd', 'Ultra SSD'),
	[AzureManagedDiskType.PremiumSSDV2]: localize('sql.migration.sku.targetStorageConfiguration.disktype.PremiumSsdV2', 'Premium SSD v2'),
};

export const BackupTypeLookup: LookupTable<string | undefined> = {
	[BackupTypeCodes.Unknown]: localize('sql.migration.restore.backuptype.unknown', 'Unknown'),
	[BackupTypeCodes.Database]: localize('sql.migration.restore.backuptype.database', 'Database'),
	[BackupTypeCodes.TransactionLog]: localize('sql.migration.restore.backuptype.transactionlog', 'Transaction log'),
	[BackupTypeCodes.File]: localize('sql.migration.restore.backuptype.file', 'File'),
	[BackupTypeCodes.DifferentialDatabase]: localize('sql.migration.restore.backuptype.differentialdatabase', 'Differential database'),
	[BackupTypeCodes.DifferentialFile]: localize('sql.migration.restore.backuptype.differentialfile', 'Differential file'),
	[BackupTypeCodes.Partial]: localize('sql.migration.restore.backuptype.partial', 'Partial'),
	[BackupTypeCodes.DifferentialPartial]: localize('sql.migration.restore.backuptype.differentialpartial', 'Differential partial'),
};

export const BackupSetRestoreStatusLookup: LookupTable<string | undefined> = {
	[InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes.None]: localize('sql.migration.restore.backupset.status.none', 'None'),
	[InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes.Queued]: localize('sql.migration.restore.backupset.status.queued', 'Queued'),
	[InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes.Restored]: localize('sql.migration.restore.backupset.status.restored', 'Restored'),
	[InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes.Restoring]: localize('sql.migration.restore.backupset.status.restoring', 'Restoring'),
	[InternalManagedDatabaseRestoreDetailsBackupSetStatusCodes.Skipped]: localize('sql.migration.restore.backupset.status.skipped', 'Skipped'),
};

export const InternalManagedDatabaseRestoreDetailsStatusLookup: LookupTable<string | undefined> = {
	[InternalManagedDatabaseRestoreDetailsStatusCodes.None]: localize('sql.migration.restore.status.none', 'None'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Initializing]: localize('sql.migration.restore.status.initializing', 'Initializing'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.NotStarted]: localize('sql.migration.restore.status.not.started', 'Not started'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.SearchingBackups]: localize('sql.migration.restore.status.searching.backups', 'Searching backups'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Restoring]: localize('sql.migration.restore.status.Restoring', 'Restoring'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.RestorePaused]: localize('sql.migration.restore.status.restore.paused', 'Restore paused'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.RestoreCompleted]: localize('sql.migration.restore.status.restore.completed', 'Restore completed'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Waiting]: localize('sql.migration.restore.status.waiting', 'Waiting'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.CompletingMigration]: localize('sql.migration.restore.status.completing.migration', 'Completing migration'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Cancelled]: localize('sql.migration.restore.status.cancelled', 'Cancelled'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Failed]: localize('sql.migration.restore.status.failed', 'Failed'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Completed]: localize('sql.migration.restore.status.completed', 'Completed'),
	[InternalManagedDatabaseRestoreDetailsStatusCodes.Blocked]: localize('sql.migration.restore.status.blocked', 'Blocked'),
};

export function STATUS_WARNING_COUNT(status: string, count: number): string | undefined {
	if (status === MigrationState.InProgress ||
		status === MigrationState.ReadyForCutover ||
		status === MigrationState.UploadingFullBackup ||
		status === MigrationState.UploadingLogBackup ||
		status === MigrationState.Restoring ||
		status === MigrationState.Creating ||
		status === MigrationState.Completing) {
		switch (count) {
			case 0:
				return undefined;
			case 1:
				return localize('sql.migration.status.warning.count.single', " ({0} warning)", count);
			default:
				return localize('sql.migration.status.warning.count.multiple', " ({0} warnings)", count);
		}
	} else {
		switch (count) {
			case 0:
				return undefined;
			case 1:
				return localize('sql.migration.status.error.count.single', " ({0} error)", count);
			default:
				return localize('sql.migration.status.error.count.multiple', " ({0} errors)", count);
		}
	}
}

export function HRS(hrs: number): string {
	return hrs > 1 ? localize('sql.migration.hrs', "{0} hrs", hrs) : localize('sql.migration.hr', "{0} hr", hrs);
}
export function DAYS(days: number): string {
	return days > 1 ? localize('sql.migration.days', "{0} days", days) : localize('sql.migration.day', "{0} day", days);
}
export function MINUTE(mins: number): string {
	return mins > 1 ? localize('sql.migration.mins', "{0} mins", mins) : localize('sql.migration.min', "{0} min", mins);
}
export function SEC(sec: number): string {
	return localize('sql.migration.sec', "{0} sec", sec);
}

export const sizeFormatter = new Intl.NumberFormat(
	undefined, {
	style: 'decimal',
	useGrouping: true,
	minimumIntegerDigits: 1,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function formatSizeMb(sizeMb: number | undefined): string {
	if (sizeMb === undefined || isNaN(sizeMb) || sizeMb < 0) {
		return '';
	} else if (sizeMb < 1024) {
		return localize('sql.migration.size.mb', "{0} MB", sizeFormatter.format(sizeMb));
	} else if (sizeMb < 1024 * 1024) {
		return localize('sql.migration.size.gb', "{0} GB", sizeFormatter.format(sizeMb / 1024));
	} else {
		return localize('sql.migration.size.tb', "{0} TB", sizeFormatter.format(sizeMb / 1024 / 1024));
	}
}

// SQL Migration Service Details page.
export const SQL_MIGRATION_SERVICE_DETAILS_SUB_TITLE = localize('sql.migration.service.details.dialog.title', "Azure Database Migration Service");
export const SQL_MIGRATION_SERVICE_DETAILS_BUTTON_LABEL = localize('sql.migration.service.details.button.label', "Close");
export const SQL_MIGRATION_SERVICE_DETAILS_IR_LABEL = localize('sql.migration.service.details.ir.label', "Self-hosted integration runtime node");
export const SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_LABEL = localize('sql.migration.service.details.authKeys.label', "Authentication keys");
export const SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_TITLE = localize('sql.migration.service.details.authKeys.title', "Authentication keys used to connect to the self-hosted integration runtime node");
export const SQL_MIGRATION_SERVICE_DETAILS_STATUS_UNAVAILABLE = localize('sql.migration.service.details.status.unavailable', "-- unavailable --");

//Source Credentials page.
export const SOURCE_CONFIGURATION = localize('sql.migration.source.configuration', "Source configuration");
export const SOURCE_CREDENTIALS = localize('sql.migration.source.credentials', "Source credentials");
export const ENTER_YOUR_SQL_CREDS = localize('sql.migration.enter.your.sql.cred', "Enter the credentials for the source SQL Server instance. These credentials will be used while migrating databases to Azure SQL.");
export const SERVER = localize('sql.migration.server', "Server");
export const USERNAME = localize('sql.migration.username', "User name");
export const SIZE = localize('sql.migration.size', "Size (MB)");
export const DATABASE_MIGRATE_TEXT = localize('sql.migrate.text', "Select the databases that you want to migrate to Azure SQL.");
export const OFFLINE_CAPS = localize('sql.migration.offline.caps', "OFFLINE");
export const SELECT_DATABASE_TO_CONTINUE = localize('sql.migration.select.database.to.continue', "Please select 1 or more databases to assess for migration");

//Assessment Dialog
export const ISSUES = localize('sql.migration.issues', "Issues");
export const SEARCH = localize('sql.migration.search', "Search");
export const INSTANCE = localize('sql.migration.instance', "Instance");
export const WARNINGS = localize('sql.migration.warnings', "Warnings");
export const IMPACTED_OBJECTS = localize('sql.migration.impacted.objects', "Impacted objects");
export const OBJECT_DETAILS = localize('sql.migration.object.details', "Object details");
export const ASSESSMENT_RESULTS = localize('sql.migration.assessment.results', "Assessment results");
export const TYPES_LABEL = localize('sql.migration.type.label', "Type:");
export const NAMES_LABEL = localize('sql.migration.name.label', "Names:");
export const DESCRIPTION = localize('sql.migration.description', "Description");
export const RECOMMENDATION = localize('sql.migration.recommendation', "Recommendation");
export const MORE_INFO = localize('sql.migration.more.info', "More info");
export const TARGET_PLATFORM = localize('sql.migration.target.platform', "Target platform");
export const WARNINGS_DETAILS = localize('sql.migration.warnings.details', "Warnings details");
export const ISSUES_DETAILS = localize('sql.migration.issues.details', "Issue details");
export const SELECT_DB_PROMPT = localize('sql.migration.select.prompt', "Click on SQL Server instance or any of the databases on the left to view its details.");
export const NO_ISSUES_FOUND_VM = localize('sql.migration.no.issues.vm', "No issues found for migrating to SQL Server on Azure Virtual Machine.");
export const NO_ISSUES_FOUND_MI = localize('sql.migration.no.issues.mi', "No issues found for migrating to Azure SQL Managed Instance.");
export const NO_ISSUES_FOUND_SQLDB = localize('sql.migration.no.issues.sqldb', "No issues found for migrating to Azure SQL Database.");
export const NO_RESULTS_AVAILABLE = localize('sql.migration.no.results', 'Assessment results are unavailable.');

export function BLOCKING_ISSUE_ARIA_LABEL(issue: string): string {
	return localize('sql.migration.issue.aria.label', "Blocking Issue: {0}", issue);
}
export function IMPACT_OBJECT_TYPE(objectType?: string): string {
	return objectType ? localize('sql.migration.impact.object.type', "Type: {0}", objectType) : '';
}
export function IMPACT_OBJECT_NAME(objectName?: string): string {
	return objectName ? localize('sql.migration.impact.object.name', "Name: {0}", objectName) : '';
}
export function DATABASES(selectedCount: number, totalCount: number): string {
	return localize('sql.migration.databases', "Databases ({0}/{1})", selectedCount, totalCount);
}
export function DATABASES_SELECTED(selectedCount: number, totalCount: number): string {
	return localize('sql.migration.databases.selected', "{0}/{1} databases selected", selectedCount, totalCount);
}
export function LOGINS_SELECTED(selectedCount: number, totalCount: number): string {
	return localize('sql.login.migrations.selected', "{0}/{1} logins selected", selectedCount, totalCount);
}
export function NUMBER_LOGINS_MIGRATING(displayedMigratingCount: number, totalMigratingCount: number): string {
	return localize('sql.migration.number.logins.migrating', "{0}/{1} migrating logins displayed", displayedMigratingCount, totalMigratingCount);
}
export function ISSUES_COUNT(totalCount: number): string {
	return localize('sql.migration.issues.count', "Issues ({0})", totalCount);
}
export function WARNINGS_COUNT(totalCount: number): string {
	return localize('sql.migration.warnings.count', "Warnings ({0})", totalCount);
}
export const AUTHENTICATION_TYPE = localize('sql.migration.authentication.type', "Authentication type");

export const REFRESH_BUTTON_LABEL = localize('sql.migration.status.refresh.label', 'Refresh');
export const STATUS_LABEL = localize('sql.migration.status.status.label', 'Status');
export const SORT_LABEL = localize('sql.migration.migration.list.sort.label', 'Sort');
export const ASCENDING_LABEL = localize('sql.migration.migration.list.ascending.label', 'Ascending');

// Saved Assessment Dialog
export const NEXT_LABEL = localize('sql.migration.saved.assessment.next', "Next");
export const CANCEL_LABEL = localize('sql.migration.saved.assessment.cancel', "Cancel");
export const SAVED_ASSESSMENT_RESULT = localize('sql.migration.saved.assessment.result', "Saved session");

// Retry Migration
export const MIGRATION_CANNOT_RETRY = localize('sql.migration.cannot.retry', 'Migration cannot be retried.');
export const RETRY_MIGRATION = localize('sql.migration.retry.migration', "Retry migration");
export const MIGRATION_RETRY_ERROR = localize('sql.migration.retry.migration.error', 'An error occurred while retrying the migration.');

// Restart Migration
export const MIGRATION_CANNOT_RESTART = localize('sql.migration.cannot.retry', 'Migration cannot be restarted.');
export const RESTART_MIGRATION_WIZARD = localize('sql.migration.restart.migration.wizard', "Restart migration wizard");
export const MIGRATION_RESTART_ERROR = localize('sql.migration.retry.migration.error', 'An error occurred while restarting the migration.');

export const INVALID_OWNER_URI = localize('sql.migration.invalid.owner.uri.error', 'Cannot connect to the database due to invalid OwnerUri (Parameter \'OwnerUri\')');
export const DATABASE_BACKUP_PAGE_LOAD_ERROR = localize('sql.migration.database.backup.load.error', 'An error occurred while accessing database details.');

// Migration Service Section Dialog
export const MIGRATION_SERVICE_SELECT_TITLE = localize('sql.migration.select.service.title', 'Select Database Migration Service');
export const MIGRATION_SERVICE_SELECT_APPLY_LABEL = localize('sql.migration.select.service.apply.label', 'Apply');
export const MIGRATION_SERVICE_CLEAR = localize('sql.migration.select.service.delete.label', 'Clear');
export const MIGRATION_SERVICE_SELECT_HEADING = localize('sql.migration.select.service.heading', 'Filter the migration list by Database Migration Service');
export const MIGRATION_SERVICE_SELECT_SERVICE_LABEL = localize('sql.migration.select.service.service.label', 'Azure Database Migration Service');
export const MIGRATION_SERVICE_SELECT_SERVICE_PROMPT = localize('sql.migration.select.service.prompt', 'Select a Database Migration Service');

// Upload Arm Template Dialog
export const SELECT_STORAGE_ACCOUNT_TITLE = localize('sql.migration.select.storage.account.title', "Select Azure Storage Account");
export const STORAGE_ACCOUNT_SELECT_HEADING = localize('sql.migration.select.storage.account.heading', "Enter the details below to select the Azure Storage account and save the script as template");
export const STORAGE_ACCOUNT_SELECT_LABEL = localize('sql.migration.select.storage.account.label', "Storage Account");
export const SAVE_LABEL = localize('sql.migration.target.provisioning.save', "Save");

export const TARGET_STORAGE_ACCOUNT_INFO = localize('sql.migration.storage.account', "Your Storage Account name");
export const TARGET_BLOB_CONTAINER_INFO = localize('sql.migration.storage.account.blob.container', "Your Blob Container name");
export const STORAGE_ACCOUNT_LOCATION = localize('sql.migration.storage.account.location', "Your Storage Account location");
export const STORAGE_ACCOUNT_RESOURCE_GROUP_INFO = localize('sql.migration.storage.account.location', "Azure region for your Storage Account. Only regions that contain a storage account will be shown.");
export const SELECT_A_STORAGE_ACCOUNT = localize('sql.migration.select.storage.select.a.storage.account', "Select a Storage Account");
export const STORAGE_ACCOUNT_SUBSCRIPTION_INFO = localize('sql.migration.storage.account.subscription', "Subscription name for your Storage Account");
export const SAVE_TEMPLATE_SUCCESS = localize('sql.migration.target.provisioning.save.template.success', "Template saved successfully");
export const SAVE_TEMPLATE_FAIL = localize('sql.migration.target.provisioning.save.template.fail', "Failed to save ARM Template");
export const UPLOAD_TEMPLATE_SUCCESS = localize('sql.migration.target.provisioning.upload.template.success', "Template uploaded successfully");
export const UPLOAD_TEMPLATE_FAIL = localize('sql.migration.target.provisioning.upload.template.fail', "Failed to upload ARM Template");


export function MIGRATION_SERVICE_SERVICE_PROMPT(serviceName: string): string {
	return localize('sql.migration.service.prompt', '{0} (change)', serviceName);
}
export const MIGRATION_SERVICE_DESCRIPTION = localize('sql.migration.select.service.description', 'Azure Database Migration Service');

// Desktop tabs
export const DESKTOP_MIGRATION_BUTTON_LABEL = localize('sql.migration.tab.button.migration.label', 'New migration');
export const DESKTOP_IMPORT_MIGRATION_BUTTON_LABEL = localize('sql.migration.tab.import.migration.label', 'Import assessment');
export const DESKTOP_IMPORT_MIGRATION_BUTTON_DESCRIPTION = localize('sql.migration.tab.import.migration.description', 'Import assessment to Azure SQL');
export const DESKTOP_MIGRATION_BUTTON_DESCRIPTION = localize('sql.migration.tab.button.migration.description', 'Migrate to Azure SQL');
export const DESKTOP_LOGIN_MIGRATION_BUTTON_LABEL = localize('sql.migration.tab.button.login.migration.label', 'New login migration (PREVIEW)');
export const DESKTOP_LOGIN_MIGRATION_BUTTON_DESCRIPTION = localize('sql.migration.tab.button.login.migration.description', 'Migrate logins to Azure SQL');
export const DESKTOP_HELP_SUPPORT_BUTTON_LABEL = localize('sql.migration.tab.button.help.support.label', 'Help + Support');
export const DESKTOP_HELP_SUPPORT_BUTTON_DESCRIPTION = localize('sql.migration.tab.button.help.support.description', 'Help + Support');
export const DESKTOP_FEEDBACK_BUTTON_LABEL = localize('sql.migration.tab.button.feedback.label', 'Feedback');
export const DESKTOP_FEEDBACK_BUTTON_DESCRIPTION = localize('sql.migration.tab.button.feedback.description', 'Feedback');
export const DESKTOP_DASHBOARD_TAB_TITLE = localize('sql.migration.tab.dashboard.title', 'Dashboard');
export const DESKTOP_MIGRATIONS_TAB_TITLE = localize('sql.migration.tab.migrations.title', 'Migrations');
export const HELP_SUPPORT_TITLE = localize('sql.migration.help.support.title', 'Help + Support');
export const SUPPORT_RESOURCES_TITLE = localize('sql.migration.support.resources.title', 'Support resources');
export const SUPPORT_RESOURCES_DESCRIPTION = localize('sql.migration.support.resources.description', 'Explore documentation');
export const SUPPORT_REQUEST_TITLE = localize('sql.migration.support.request.title', 'Support request');
export const SUPPORT_REQUEST_DESCRIPTION = localize('sql.migration.support.request.descrption', 'Create a support request');
export const SUPPORT_REQUEST_NOTE = localize('sql.migration.support.request.note', 'To receive assistance from Microsoft customer support, please submit a support request.');
export const COMMUNITY_SUPPORT_TITLE = localize('sql.migration.community.support.title', 'Community support')
export const COMMUNITY_SUPPORT_DESCRIPTION = localize('sql.migration.community.support.description', 'Connect with Microsoft Community');
export const COMMUNITY_SUPPORT_NOTE = localize('sql.migration.community.support.note', 'You can post your question with the Microsoft community support through the Q&A channel.');

// dashboard tab
export const DASHBOARD_HELP_LINK_MIGRATE_USING_ADS = localize('sql.migration.dashboard.help.link.migrateUsingADS', 'Migrate databases using Azure Data Studio');
export const DASHBOARD_HELP_DESCRIPTION_MIGRATE_USING_ADS = localize('sql.migration.dashboard.help.description.migrateUsingADS', 'The Azure SQL Migration extension for Azure Data Studio provides capabilities to assess, get right-sized Azure recommendations and migrate SQL Server databases to Azure.');
export const DASHBOARD_HELP_LINK_MI_TUTORIAL = localize('sql.migration.dashboard.help.link.mi', 'Tutorial:  Migrate to Azure SQL Managed Instance (online)');
export const DASHBOARD_HELP_DESCRIPTION_MI_TUTORIAL = localize('sql.migration.dashboard.help.description.mi', 'A step-by-step tutorial to migrate databases from a SQL Server instance (on-premises or Azure Virtual Machines) to Azure SQL Managed Instance with minimal downtime.');
export const DASHBOARD_HELP_LINK_VM_TUTORIAL = localize('sql.migration.dashboard.help.link.vm', 'Tutorial:  Migrate to SQL Server on Azure Virtual Machines (online)');
export const DASHBOARD_HELP_DESCRIPTION_VMTUTORIAL = localize('sql.migration.dashboard.help.description.vm', 'A step-by-step tutorial to migrate databases from a SQL Server instance (on-premises) to SQL Server on Azure Virtual Machines with minimal downtime.');
export const DASHBOARD_HELP_LINK_SQLDB_TUTORIAL = localize('sql.migration.dashboard.help.link.sqldb', 'Tutorial:  Migrate to SQL Server on Azure SQL Database (offline)');
export const DASHBOARD_HELP_DESCRIPTION_SQLDBTUTORIAL = localize('sql.migration.dashboard.help.description.sqldb', 'A step-by-step tutorial to migrate databases from a SQL Server instance (on-premises or Azure Virtual Machines) to Azure SQL Database.');
export const DASHBOARD_HELP_LINK_DMS_GUIDE = localize('sql.migration.dashboard.help.link.dmsGuide', 'Azure Database Migration Guides');
export const DASHBOARD_HELP_DESCRIPTION_DMS_GUIDE = localize('sql.migration.dashboard.help.description.dmsGuide', 'A hub of migration articles that provides step-by-step guidance for migrating and modernizing your data assets in Azure.');

// Error info
export const DATABASE_MIGRATION_STATUS_TITLE = localize('sql.migration.error.title', 'Migration status details');
export const TABLE_MIGRATION_STATUS_TITLE = localize('sql.migration.table.error.title', 'Table migration status details');

export function DATABASE_MIGRATION_STATUS_LABEL(status?: string): string {
	return localize('sql.migration.database.migration.status.label', 'Database migration status: {0}', status ?? '');
}

export function LOGIN_MIGRATION_STATUS_LABEL(status?: string): string {
	return localize('sql.migration.database.migration.status.label', 'Login migration status: {0}', status ?? '');
}

export function TABLE_MIGRATION_STATUS_LABEL(status?: string): string {
	return localize('sql.migration.table.migration.status.label', 'Table migration status: {0}', status ?? '');
}

export const SQLDB_COL_TABLE_NAME = localize('sql.migration.sqldb.column.tablename', 'Table name');
export const SQLDB_COL_DATA_READ = localize('sql.migration.sqldb.column.dataread', 'Data read');
export const SQLDB_COL_DATA_WRITTEN = localize('sql.migration.sqldb.column.datawritten', 'Data written');
export const SQLDB_COL_ROWS_READ = localize('sql.migration.sqldb.column.rowsread', 'Rows read');
export const SQLDB_COL_ROWS_COPIED = localize('sql.migration.sqldb.column.rowscopied', 'Rows copied');
export const SQLDB_COL_COPY_THROUGHPUT = localize('sql.migration.sqldb.column.copythroughput', 'Copy throughput');
export const SQLDB_COL_COPY_DURATION = localize('sql.migration.sqldb.column.copyduration', 'Copy duration');
export const SQLDB_COL_PARRALEL_COPY_TYPE = localize('sql.migration.sqldb.column.parallelcopytype', 'Parallel copy type');
export const SQLDB_COL_USED_PARALLEL_COPIES = localize('sql.migration.sqldb.column.usedparallelcopies', 'Used parallel copies');
export const SQLDB_COL_COPY_START = localize('sql.migration.sqldb.column.copystart', 'Copy start');

// Multi Step Status Dialog
export const COPY_RESULTS = localize('sql.migration.multi.step.status.dialog.copy.results', "Copy results");
export const MULTI_STEP_RESULTS_HEADING = localize('sql.migration.multi.step.status.dialog.heading', "Step details");
export const STEPS_TITLE = localize('sql.migration.multi.step.status.steps.title', "Steps");
export const RUNNING_MULTI_STEPS_HEADING = localize('sql.migration.running.multi.steps.heading', "We are running the following steps:");
export const COMPLETED_MULTI_STEPS_HEADING = localize('sql.migration.completed.multi.steps.heading', "We ran the following steps:");
export const SOME_STEPS_ARE_STILL_RUNNING = localize('sql.migration.multi.step.some.steps.are.still.running', "Some steps are still running.");
export const ALL_STEPS_SUCCEEDED = localize('sql.migration.multi.step.all.steps.succeeded', "All steps succeeded.");
export function ALL_STEPS_COMPLETED_ERRORS(msg: string): string {
	return localize(
		'sql.migration.multi.step.all.steps.completed.errors',
		"All steps completed with the following error(s):{0}{1}", EOL, msg);
}
export function RESULTS_INFO_BOX_STATUS(state: string | undefined, errors?: string[]): string {
	const status = state ?? '';
	if (errors && errors.length > 0) {
		return localize(
			'sql.migration.multi.step.status.errors',
			"Step status: {0}{1}{2}", status, EOL, errors.join(EOL));
	} else {
		return localize(
			'sql.migration.multi.step.status',
			"Step status: {0}", status);
	}
}


//TDE Configuration Dialog
export const TDE_WIZARD_TITLE = localize('sql.migration.tde.wizard.title', "Encrypted database selected.");
export const TDE_WIZARD_DESCRIPTION = localize('sql.migration.tde.wizard.description', "To migrate an encrypted database successfully you need to provide access to the encryption certificates or migrate certificates manually before proceeding with the migration. {0}.");
export const TDE_WIZARD_MIGRATION_CAPTION = localize('sql.migration.tde.wizard.optionscaption', "Certificate migration");
export const TDE_WIZARD_MIGRATION_OPTION_ADS = localize('sql.migration.tde.wizard.optionads', "Export my certificates and private keys to the target.");
export const TDE_WIZARD_MIGRATION_OPTION_ADS_CONFIRM = localize('sql.migration.tde.wizard.optionadsconfirm', "I give consent to use my credentials for accessing the certificates.");
export const TDE_WIZARD_MIGRATION_OPTION_MANUAL = localize('sql.migration.tde.wizard.optionmanual', "I have already migrated my certificates and private keys to the target.");
export const TDE_BUTTON_CAPTION = localize('sql.migration.tde.button.caption', "Edit");
export const TDE_WIZARD_MSG_MANUAL = localize('sql.migration.tde.msg.manual', "You have not given Azure Data Studio access to migrate the encryption certificates.");
export const TDE_WIZARD_MSG_TDE = localize('sql.migration.tde.msg.tde', "You have given Azure Data Studio access to migrate the encryption certificates and database.");
export const TDE_WIZARD_MSG_EMPTY = localize('sql.migration.tde.msg.empty', "No encrypted database selected.");

export const TDE_VALIDATION_GROUP_TITLE = localize('sql.migration.tde.validation.group.title', "Certificate validations");
export const TDE_VALIDATION_TITLE = localize('sql.migration.tde.validation.title', "Validation");
export const TDE_VALIDATION_REQUIREMENTS_MESSAGE = localize('sql.migration.tde.validation.requirements.message', "In order for certificate migration to succeed, you must meet all of the requirements listed below.\n\nClick \"Run validation\" to check that requirements are met.");
export const TDE_VALIDATION_STATUS_PENDING = localize('sql.migration.tde.validation.status.pending', "Pending");
export const TDE_VALIDATION_STATUS_RUNNING = localize('sql.migration.tde.validation.running', "Running");
export const TDE_VALIDATION_STATUS_SUCCEEDED = localize('sql.migration.tde.validation.status.succeeded', "Succeeded");
export const TDE_VALIDATION_STATUS_RUN_VALIDATION = localize('sql.migration.tde.validation.run.validation', "Run validation");
export const TDE_VALIDATION_DESCRIPTION = localize('sql.migration.tde.validation.description', "Description");
export const TDE_VALIDATION_ERROR = localize('sql.migration.tde.validation.error', "Error");
export const TDE_VALIDATION_TROUBLESHOOTING_TIPS = localize('sql.migration.tde.validation.troubleshooting.tips', "Troubleshooting tips");

export function TDE_MIGRATION_ERROR(message: string): string {
	return localize('sql.migration.starting.migration.error', "The following error has occurred while starting the certificate migration: '{0}'", message);
}

export function TDE_MIGRATION_ERROR_DB(name: string, message: string): string {
	return localize('sql.migration.starting.migration.dberror', "Error migrating certificate for database {0}. {1}", name, message);
}

export function TDE_MSG_DATABASES_SELECTED(selected: number, message: string): string {
	return localize('sql.migration.tde.msg.databases.selected', "{0} Transparent Data Encryption enabled databases selected for migration. {1}", selected, message);
}

export function TDE_WIZARD_DATABASES_SELECTED(encryptedCount: number, totalCount: number): string {
	return localize('sql.migration.tde.wizard.databases.selected', "{0} out of {1} selected database(s) is using transparent data encryption.", encryptedCount, totalCount);
}


export const TDE_WIZARD_MIGRATION_OPTION_MANUAL_WARNING = localize('sql.migration.tde.wizard.optionmanual.warning', "Certificates must be migrated before proceeding with the database migration otherwise a failure will occur. {0} about manually migrating TDE certificates.");

export const TDE_WIZARD_ADS_CERTS_INFO = localize('sql.migration.tde.cert.network.info', "Please enter a network path where SQL Server will export the certificates. Also verify that SQL Server service has write access to this path and the current user should have administrator privileges on the computer where this network path is.");

export const TDE_WIZARD_CERTS_NETWORK_SHARE_LABEL = localize('sql.migration.tde.wizard.network.share.label', "Network path for certificate");
export const TDE_WIZARD_CERTS_NETWORK_SHARE_PLACEHOLDER = localize('sql.migration.tde.wizard.network.share.placeholder', "Enter network path");
export const TDE_WIZARD_CERTS_NETWORK_SHARE_INFO = localize('sql.migration.tde.wizard.network.share.info', "Network path where certificate will be placed.");

export const TDE_MIGRATE_BUTTON = localize('sql.migration.tde.button.migrate', "Migrate certificates");
export const TDE_WIZARD_CERT_MIGRATION_BUTTON_MUST_BE_CLICKED = localize('sql.migration.tde.cert.migration.info', "You must click the '{0}' button before proceeding to the next page of the wizard.", TDE_MIGRATE_BUTTON);


export const STATE_CANCELED = localize('sql.migration.state.canceled', "Canceled");
export const STATE_PENDING = localize('sql.migration.state.pending', "Pending");
export const STATE_RUNNING = localize('sql.migration.state.running', "Running");
export const STATE_SUCCEEDED = localize('sql.migration.state.succeeded', "Succeeded");
export const STATE_FAILED = localize('sql.migration.state.failed', "Failed");

export const TDE_MIGRATEDIALOG_TITLE = localize('sql.migration.validation.dialog.title', "Certificates Migration");
export const TDE_MIGRATE_DONE_BUTTON = localize('sql.migration.tde.migrate.done.button', "Done");
export const TDE_MIGRATE_HEADING = localize('sql.migration.tde.migrate.heading', "Migrating the certificates from the following databases:");

export const TDE_MIGRATE_REQUIRED = localize('sql.migration.tde.migrate.required', "TDE certificate migration must be successful before continuing.");
export const TDE_MIGRATE_COLUMN_DATABASES = localize('sql.migration.tde.migrate.column.databases', "Databases");
export const TDE_MIGRATE_COLUMN_STATUS = localize('sql.migration.tde.migrate.column.status', "Status");
export const TDE_MIGRATE_RETRY_VALIDATION = localize('sql.migration.tde.migrate.start.validation', "Retry migration");
export const TDE_MIGRATE_COPY_RESULTS = localize('sql.migration.tde.migrate.copy.results', "Copy migration results");
export const TDE_MIGRATE_RESULTS_HEADING = localize('sql.migration.tde.migrate.results.heading', "Certificates migration progress details:");
export const TDE_MIGRATE_RESULTS_HEADING_PREVIOUS = localize('sql.migration.tde.migrate.results.heading.previous', "Previous certificates migration results:");
export const TDE_MIGRATE_RESULTS_HEADING_COMPLETED = localize('sql.migration.tde.migrate.results.heading.completed', "Certificates migration results:");
export const TDE_MIGRATE_VALIDATION_COMPLETED = localize('sql.migration.tde.migrate.validation.completed', "Migration completed successfully.");
export const TDE_MIGRATE_VALIDATION_CANCELED = localize('sql.migration.tde.migrate.validation.camceled', "Migration canceled");

export function TDE_MIGRATE_VALIDATION_COMPLETED_ERRORS(msg: string): string {
	return localize(
		'sql.migration.tde.migrate.completed.errors',
		"Migration completed with the following error(s):{0}{1}", EOL, msg);
}
export function TDE_MIGRATE_VALIDATION_STATUS(state: string | undefined, errors: string): string {
	const status = state ?? '';
	return localize(
		'sql.migration.tde.migrate.status.details',
		"Migration status: {0}{1}{2}", status, EOL, errors);
}

export const TDE_MIGRATE_MESSAGE_SUCCESS = localize('sql.migration.tde.migrate.success', "Certificates migration completed successfully.  Please click Next to proceed with the migration.");
export function TDE_MIGRATE_MESSAGE_CANCELED_ERRORS(msg: string): string {
	return localize(
		'sql.migration.tde.migrate.canceled.errors',
		"Validation was canceled with the following error(s):{0}{1}", EOL, msg);
}
export const TDE_MIGRATE_MESSAGE_CANCELED = localize('sql.migration.tde.migrate.canceled', "Certificates migration was canceled. Please run and complete the certificates migration to continue.");
export const TDE_MIGRATE_MESSAGE_NOT_RUN = localize('sql.migration.tde.migrate.not.run', "Certificates migration has not been run for the current configuration. Please run and complete the certificates migration to continue.");

export function TDE_MIGRATE_STATUS_ERROR(state: string, error: string): string {
	const status = state ?? '';
	return localize(
		'sql.migration.tde.migrate.status.error',
		"{0}{1}{2}",
		status,
		EOL,
		error);
}

export function TDE_COMPLETED_STATUS(completed: number, total: number): string {
	return localize('sql.migration.tde.progress.update', "{0} of {1} completed", completed, total);
}

// Schema migration
export const FULL_SCHEMA_MISSING_ON_TARGET = localize('sql.migration.schema.full.missing', "No schema was found on target. This option must be selected to migrate this database. No tables selected will migrate missing schema only.");
export const PARTIAL_SCHEMA_ON_TARGET = localize('sql.migration.schema.partial.missing', "Missing schemas on the target. Some tables are disabled and cannot be migrated unless this option is selected. No tables selected will migrate missing schema only.");
export const FULL_SCHEMA_ON_TARGET = localize('sql.migration.schema.no.missing', "Schema was found on target. Schema migration is not required.");
export const ALL_SOURCE_TABLES_EMPTY = localize('sql.migration.all.source.tables.empty', "All of source tables are empty. No table is available to select for data migration. But they are available for schema migration if they do not exist on target.");
export const SCHEMA_MIGRATION_INFO = localize('sql.migration.schema.migration.info', "Select this option to migrate missing tables on your Azure SQL target");
export const DATA_MIGRATION_INFO = localize('sql.migration.data.migration.info', "Select tables to migrate data to your Azure SQL target");
export const SCHEMA_MIGRATION_HEADER = localize('sql.migration.schema.migration.header', "Schema migration");
export const DATA_MIGRATION_HEADER = localize('sql.migration.data.migration.header', "Data migration");
export const SCHEMA_MIGRATION_CHECKBOX_INFO = localize('sql.migration.schema.migration.checkbox.info', "Migrate schema to target");
export const SCHEMA_ONLY = localize('sql.migration.schema.only', "Schema only");
export const DATA_ONLY = localize('sql.migration.data.only', "Data only");
export const SCHEMA_AND_DATA = localize('sql.migration.schema.data', "Schema and data");
export const BACKUP_AND_RESTORE = localize('sql.migration.backup.restore', "Backup and restore");
export const SCHEMA_MIGRATION_STATUS = localize('sql.migration.schema.status', "Schema migration status");
export const OBJECTS_COLLECTED = localize('sql.migration.schema.objects.collection', "Objects collected");
export const COLLECTION_STARTED = localize('sql.migration.schema.collection.started', "Collection started");
export const COLLECTION_ENDED = localize('sql.migration.schema.collection.ended', "Collection ended");
export const SCRIPT_GENERATION = localize('sql.migration.schema.script.generation', "Script generation");
export const SCRIPTING_STARTED = localize('sql.migration.schema.script.started', "Scripting started");
export const SCRIPTING_ENDED = localize('sql.migration.schema.script.ended', "Scripting ended");
export const SCRIPTED_OBJECTS_COUNT = localize('sql.migration.schema.script.count', "Scripted objects count");
export const SCRIPTING_ERROR_COUNT = localize('sql.migration.schema.script.fail.count', "Scripting error count");
export const MIGRATION_TYPE = localize('sql.migration.schema.type', "Migration type");
export const SCRIPT_DEPLOYMENT = localize('sql.migration.schema.script.deployment', "Script deployment");
export const DEPLOYMENT_STARTED = localize('sql.migration.schema.script.deployment.started', "Deployment started");
export const DEPLOYMENT_ENDED = localize('sql.migration.schema.script.deployment.ended', "Deployment ended");
export const DEPLOYMENT_COUNT = localize('sql.migration.schema.script.deployment.count', "Deployment count");
export const DEPLOYMENT_ERROR_COUNT = localize('sql.migration.schema.script.deployment.error.count', "Deployment error count");
export const SCHEMA_MIGRATION_ASSESSMENT_WARNING_MESSAGE = localize('sql.migration.schema.assessment.warning.message', "The detected issues shown below might fail the schema migration. Some of them might be entirely unsupported and the others might be partially supported in Azure SQL Database. \nTherefore, please review the assessment results and make sure all of the issues will not fail the schema migration.\nHowever, it is allowed to proceed the schema migration and Azure Database Migration Service will migrate the objects as possible as it can.");
export const SchemaMigrationFailedRulesLookup: LookupTable<string | undefined> = {
	["ComputeClause"]: localize('sql.migration.schema.rule.compute', 'COMPUTE'),
	["CrossDatabaseReferences"]: localize('sql.migration.schema.rule.crossdatabasereferences', 'CROSS DATABASE REFERENCE'),
	["FileStream"]: localize('sql.migration.schema.filestream', 'FILESTREAM'),
	["OpenRowsetWithNonBlobDataSourceBulk"]: localize('sql.migration.schema.openrowset.nonazureblob', 'OPENROWSET WITH NON-AZURE BLOB'),
	["OpenRowsetWithSQLAndNonSQLProvider"]: localize('sql.migration.schema.openrowset.provider', 'OPENROWSET WITH PROVIDER'),
	["BulkInsert"]: localize('sql.migration.schema.bulkinsert', 'BULK INSERT'),
	["CryptographicProvider"]: localize('sql.migration.schema.cryptographicprovider', 'CRYPTOGRAPHIC PROVIDER'),
	["MSDTCTransactSQL"]: localize('sql.migration.schema.msdtctransactsql', 'BEGIN DISTRIBUTED TRANSACTION'),
	["DisableDefCNSTCHK"]: localize('sql.migration.schema.disabledefcnstchk', 'DISABLE_DEF_CNST_CHK'),
	["FastFirstRowHint"]: localize('sql.migration.schema.fastfirstrow', 'FASTFIRSTROW'),
	["RAISERROR"]: localize('sql.migration.schema.raiserror', 'RAISERROR'),
	default: undefined
};
export const SCHEMA_MIGRATION_COLUMN_LABLE = localize('sql.migration.schema.migration.column.label', "Schema migration");
export const UNAVAILABLE_TABLE_NAME_COLUMN = localize('sql.migration.unavailable.table.name.column', "Table name");
export const NOT_EXIST_IN_TARGET_TABLE_NAME_COLUMN = localize('sql.migration.not.exist.in.target.table.name.column', "Not exist on target");
export function TABLE_SELECTION_COUNT_TO_TARGET(selectedCount: number, rowCount: number): string {
	return localize('sql.migration.table.selection.count.to.target', "{0} of {1} tables selected for migration", formatNumber(selectedCount), formatNumber(rowCount));
}
export function AVAILABLE_TABLE_COUNT_ON_TARGET(rowCount: number): string {
	return localize('sql.migration.available.table.count.on.target', "Available on target ({0})", formatNumber(rowCount));
}
export function MISSING_TARGET_TABLES_COUNT(missingCount: number): string {
	return localize('sql.migration.table.missing.count', "Missing on target ({0})", formatNumber(missingCount));
}
export function UNAVAILABLE_SOURCE_TABLES_COUNT(unavailableCount: number): string {
	return localize('sql.migration.table.unavailable.count', "Unavailable for data migration ({0})", formatNumber(unavailableCount));
}
export const MISSING_TABLES_HEADING = localize('sql.migration.missing.tables.heading', 'All of tables below are missing on target. To migrate the data in these tables, select the migrate schema option above.');
export const UNAVAILABLE_SOURCE_TABLES_HEADING = localize('sql.migration.unavailable.source.tables.heading', 'All of tables below are empty. No table is available to select for data migration. But if they do not exist on target, schema migration is available.');
export const DATABASE_MISSING_TABLES = localize('sql.migration.database.missing.tables', "0 tables on source database found on target database. To migrate the data in the tables select the migrate schema option above.");
export const MIGRATION_TYPE_TOOL_TIP = localize('sql.migration.database.migration.migration.type.tool.tip', "Migration type includes: Schema only migration, Data only migration, Schema and data migration.");
export const SchemaMigrationStatusLookup: LookupTable<string | undefined> = {
	[MigrationState.CollectionCompleted]: localize('sql.migration.status.collectioncompleted', 'Collection completed'),
	[MigrationState.PrefetchObjects]: localize('sql.migration.status.prefetchobjects', 'Prefetch objects'),
	[MigrationState.GetDependency]: localize('sql.migration.status.getdependency', 'Get dependency'),
	[MigrationState.ScriptObjects]: localize('sql.migration.status.scriptobjects', 'Scripting objects'),
	[MigrationState.ScriptViewIndexes]: localize('sql.migration.status.scriptindexes', 'Scripting indexes'),
	[MigrationState.ScriptOwnership]: localize('sql.migration.status.scriptownership', 'Scripting ownerships'),
	[MigrationState.GeneratingScript]: localize('sql.migration.status.generatingscript', 'Generating script'),
	[MigrationState.GeneratingScriptCompleted]: localize('sql.migration.status.generatingcompleted', 'Generating script completed'),
	[MigrationState.DeployingSchema]: localize('sql.migration.status.deploying.schema', 'Deploying schema'),
	[MigrationState.DeploymentCompleted]: localize('sql.migration.status.deployment.completed', 'Deployment completed'),
	[MigrationState.Completed]: localize('sql.migration.status.completed', 'Completed'),
	[MigrationState.CompletedWithError]: localize('sql.migration.status.completedwitherrors', 'Completed with errors'),
	default: undefined
};
export function SCHEMA_MIGRATION_UPDATE_IR_VERSION_ERROR_MESSAGE(minIrVersion: IntegrationRuntimeVersionInfo, irVersions: IntegrationRuntimeVersionInfo[]): string {
	const irVersionStrings: string[] = irVersions.map(v => `${v.major}.${v.minor}.${v.build}.${v.revision}`);
	return localize(
		'sql.schema.migration.update.ir.version.error',
		"Schema migration requires an Integration Runtime version of [{0}] or higher. The current node version(s) are: [{1}]. Please install a newer version of the Integration Runtime to enable schema migration support.",
		minIrVersion.major + "." + minIrVersion.minor,
		irVersionStrings.join(", ")
	);
}
export function SQLDB_MIGRATION_DIFFERENT_IR_VERSION_ERROR_MESSAGE(irVersions: IntegrationRuntimeVersionInfo[]): string {
	const irVersionStrings: string[] = irVersions.map(v => `${v.major}.${v.minor}.${v.build}.${v.revision}`);
	return localize(
		'sql.migration.different.ir.version.error',
		"Integration Runtime versions [{0}] are not the same. Please have the same version of Integration Runtime across all nodes for consistency and optimal performance.",
		irVersionStrings.join(", ")
	);
}
export const SCHEMA_MIGRATION_WINDOWS_AUTH_ERROR_MESSAGE = localize('sql.schema.migration.windows.auth.error', "Schema migration is not currently supported for connectivity to source instance using Windows Authentication. Please use SQL Authentication to enable schema migration support.");
export const SCHEMA_MIGRATION_INFORMATION_MESSAGE = localize(
	'sql.schema.migration.information',
	"Schema migration is in {0} in Step 6. It requires an Integration Runtime version of [{1}] or higher. Schema deployment will make a best effort to deploy database objects. Schema deployment errors will not prevent data migration.",
);
export const MIN_IR_VERSION_SUPPORT_SCHEMA_MIGRATION = localize('sql.schema.migration.min.version', "5.37.8767.4");
