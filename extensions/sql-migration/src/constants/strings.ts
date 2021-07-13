/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccount } from 'azurecore';
import * as nls from 'vscode-nls';
import { SupportedAutoRefreshIntervals } from '../api/utils';
import { MigrationSourceAuthenticationType } from '../models/stateMachine';
const localize = nls.loadMessageBundle();


// #region wizard
export function WIZARD_TITLE(instanceName: string): string {
	return localize('sql-migration.wizard.title', "Migrate '{0}' to Azure SQL", instanceName);
}
export const SOURCE_CONFIGURATION_PAGE_TITLE = localize('sql.migration.wizard.source_configuration.title', "SQL Source Configuration");
// //#endregion

// Assessments Progress Page
export const ASSESSMENT_PROGRESS = localize('sql.migration.assessments.progress', "Assessments Progress");
export const ASSESSMENT_IN_PROGRESS = localize('sql.migration.assessment.in.progress', "Assessment in progress");
export function ASSESSMENT_IN_PROGRESS_CONTENT(dbName: string) {
	return localize('sql.migration.assessment.in.progress.content', "We are assessing the databases in your SQL server instance {0} to identify the right Azure SQL target.\n\nThis may take some time.", dbName);
}
export const COLLECTING_SOURCE_CONFIGURATIONS = localize('sql.migration.collecting_source_configurations', "Collecting source configurations");
export const COLLECTING_SOURCE_CONFIGURATIONS_INFO = localize('sql.migration.collecting_source_configurations.info', "We need to collect some information about how your data is configured currently.\nThis may take some time.");
export const COLLECTING_SOURCE_CONFIGURATIONS_ERROR = (error: string = ''): string => {
	return localize('sql.migration.collecting_source_configurations.error', "There was an error when gathering information about your data configuration. {0}", error);
};

export const SKU_RECOMMENDATION_PAGE_TITLE = localize('sql.migration.wizard.sku.title', "Azure SQL Target");
export const SKU_RECOMMENDATION_ALL_SUCCESSFUL = (databaseCount: number): string => {
	return localize('sql.migration.wizard.sku.all', "Based on the assessment results, all {0} of your database(s) in online state can be migrated to Azure SQL.", databaseCount);
};
export const SKU_RECOMMENDATION_SOME_SUCCESSFUL = (migratableCount: number, databaseCount: number): string => {
	return localize('sql.migration.wizard.sku.some', "Based on the results of our source configuration scans, {0} out of {1} of your databases can be migrated to Azure SQL.", migratableCount, databaseCount);
};
export const SKU_RECOMMENDATION_CHOOSE_A_TARGET = localize('sql.migration.wizard.sku.choose_a_target', "Choose your Azure SQL target");

export const SKU_RECOMMENDATION_NONE_SUCCESSFUL = localize('sql.migration.sku.none', "Based on the results of our source configuration scans, none of your databases can be migrated to Azure SQL.");
export const SKU_RECOMMENDATION_MI_CARD_TEXT = localize('sql.migration.sku.mi.card.title', "Azure SQL Managed Instance (PaaS)");
export const SKU_RECOMMENDATION_VM_CARD_TEXT = localize('sql.migration.sku.vm.card.title', "SQL Server on Azure Virtual Machine (IaaS)");
export const SELECT_AZURE_MI = localize('sql.migration.select.azure.mi', "Select your target Azure subscription and your target Azure SQL Managed Instance");
export const SELECT_AZURE_VM = localize('sql.migration.select.azure.vm', "Select your target Azure Subscription and your target SQL Server on Azure Virtual Machine for your target.");
export const SUBSCRIPTION_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.subscription.title', "Azure Subscription Selection");
export const SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE = localize('sql.migration.wizard.subscription.azure.account.title', "Azure Account");
export const SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE = localize('sql.migration.wizard.subscription.azure.subscription.title', "Azure Subscription");
export const SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE = localize('sql.migration.wizard.subscription.azure.product.title', "Azure Product");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI = localize('sql.migration.sku.recommendation.view.assessment.mi', "View assessment results and select one or more  database(s) to migrate to Azure SQL Managed Instance (PaaS)");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_VM = localize('sql.migration.sku.recommendation.view.assessment.vm', "View assessment results and select one or more  database(s) to migrate to SQL Server on Azure Virtual Machine (IaaS)");
export const VIEW_SELECT_BUTTON_LABEL = localize('sql.migration.view.select.button.label', "View/Select");
export function TOTAL_DATABASES_SELECTED(selectedDbCount: number, totalDbCount: number): string {
	return localize('total.databases.selected', "{0} of {1} Database(s) selected.", selectedDbCount, totalDbCount);
}
export const SELECT_TARGET_TO_CONTINUE = localize('sql.migration.select.target.to.continue', "Please select a target to continue");
export const SELECT_DATABASE_TO_MIGRATE = localize('sql.migration.select.database.to.migrate', "Please select databases to migrate");
export const ASSESSMENT_COMPLETED = (serverName: string): string => {
	return localize('sql.migration.generic.congratulations', "We have completed the assessment of your SQL Server Instance '{0}'.", serverName);
};
export function ASSESSMENT_TILE(serverName: string): string {
	return localize('sql.migration.assessment', "Assessment Dialog for '{0}'", serverName);
}
export function CAN_BE_MIGRATED(eligibleDbs: number, totalDbs: number): string {
	return localize('sql.migration.can.be.migrated', "{0} out of {1} databases can be migrated", eligibleDbs, totalDbs);
}

// Accounts page
export const ACCOUNTS_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.account.title', "Azure Account");
export const ACCOUNTS_SELECTION_PAGE_DESCRIPTION = localize('sql.migration.wizard.account.description', "Select an Azure account linked to Azure Data Studio or link one now.");
export const ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR = localize('sql.migration.wizard.account.noaccount.error', "There is no linked account. Please add an account.");
export const ACCOUNT_LINK_BUTTON_LABEL = localize('sql.migration.wizard.account.add.button.label', "Link account");
export function accountLinkedMessage(count: number): string {
	return count === 1 ? localize('sql.migration.wizard.account.count.single.message', '{0} account linked', count) : localize('sql.migration.wizard.account.count.multiple.message', '{0} accounts linked', count);
}
export const AZURE_TENANT = localize('sql.migration.azure.tenant', "Azure AD tenant");
export function ACCOUNT_STALE_ERROR(account: AzureAccount) {
	return localize('azure.accounts.accountStaleError', "The access token for selected account '{0}' is no longer valid. Please click the 'Link Account' button and refresh the account or select a different account.", `${account.displayInfo.displayName} (${account.displayInfo.userId})`);
}

// database backup page
export const DATABASE_BACKUP_PAGE_TITLE = localize('sql.migration.database.page.title', "Database Backup");
export const DATABASE_BACKUP_PAGE_DESCRIPTION = localize('sql.migration.database.page.description', "Select the location of your database backups to use for migration.");

export const DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL = localize('sql.migration.nc.network.share.radio.label', "My database backups are on a network share");
export const DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL = localize('sql.migration.nc.blob.storage.radio.label', "My database backups are in an Azure Storage Blob Container");
export const DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL = localize('sql.migration.nc.file.share.radio.label', "My database backups are in an Azure Storage File Share (Coming soon)");



export const DATABASE_BACKUP_NETWORK_SHARE_HEADER_TEXT = localize('sql.migration.network.share.header.text', "Network share details");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT = localize('sql.migration.network.share.help.text', "Provide the network share location that contains backups and the user credentials that has read access to the share");
export const DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL = localize('sql.migration.network.share.location.label', "Network share location that contains backups.");
export const DATABASE_SERVICE_ACCOUNT_INFO_TEXT = localize('sql.migration.service.account.info.text', "Ensure that the service account running the source SQL Server instance has read privileges on the network share.");
export const DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL = localize('sql.migration.network.share.windows.user.label', "Windows user account with read access to the network share location.");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL = localize('sql.migration.network.share.password.label', "Password");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER = localize('sql.migration.network.share.password.placeholder', "Enter password");
export const DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HEADER = localize('sql.migration.network.share.azure.header', "Storage account details");
export const DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP = localize('sql.migration.network.share.azure.help', "Provide the Azure storage account where backups will be uploaded to.");
export const DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_LABEL = localize('sql.migration.network.share.subscription.label', "Select the subscription that contains the storage account.");
export const DATABASE_BACKUP_SUBSCRIPTION_PLACEHOLDER = localize('sql.migration.network.share.subscription.placeholder', "Select subscription");
export const DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_LABEL = localize('sql.migration.network.share.storage.account.label', "Select the storage account where backup files will be copied.");
export const DATABASE_BACKUP_STORAGE_ACCOUNT_PLACEHOLDER = localize('sql.migration.network.share.storage.account.placeholder', "Select account");
export const DUPLICATE_NAME_ERROR = localize('sql.migration.unique.name', "Select a unique name for this target database");
export function DATABASE_ALREADY_EXISTS_MI(dbName: string, targetName: string): string {
	return localize('sql.migration.database.already.exists', "Database '{0}' already exists on target Managed Instance '{1}'.", dbName, targetName);
}
export const DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL = localize('sql.migration.blob.storage.subscription.label', "Select the subscription that contains the storage account.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL = localize('sql.migration.blob.storage.account.label', "Select the storage account that contains the backup files.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_LABEL = localize('sql.migration.blob.storage.container.label', "Select the container that contains the backup files.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_PLACEHOLDER = localize('sql.migration.blob.storage.container.placeholder', "Select container");
export const DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL = localize('sql.migration.file.share.subscription.label', "Select the subscription that contains the file share.");
export const DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL = localize('sql.migration.file.share.storage.account.label', "Select the storage account that contains the file share.");
export const DATABASE_BACKUP_FILE_SHARE_LABEL = localize('sql.migration.file.share.label', "Select the file share that contains the backup files.");
export const DATABASE_BACKUP_FILE_SHARE_PLACEHOLDER = localize('sql.migration.file.share.placeholder', "Select share");
export const DATABASE_BACKUP_MIGRATION_MODE_LABEL = localize('sql.migration.database.migration.mode.label', "Migration mode");
export const DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION = localize('sql.migration.database.migration.mode.description', "Choose from the following migration modes to migrate to your Azure SQL target based on your downtime requirements.");
export const DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL = localize('sql.migration.database.migration.mode.online.label', "Online migration");
export const DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION = localize('sql.migration.database.migration.mode.online.description', "Application downtime is limited to cut over at the end of migration.");
export const DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION = localize('sql.migration.database.migration.mode.offline.description', "Application downtime will start when the migration starts.");
export const DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL = localize('sql.migration.database.migration.mode.offline.label', "Offline migration");
export const DATABASE_BACKUP_EMAIL_NOTIFICATION_LABEL = localize('sql.migration.database.backup.email.notification.label', "Email notifications");
export const DATABASE_BACKUP_EMAIL_NOTIFICATION_CHECKBOX_LABEL = localize('sql.migration.database.backup.email.notification.checkbox.label', "Notify me when migration is complete");
export const NO_SUBSCRIPTIONS_FOUND = localize('sql.migration.no.subscription.found', "No subscription found");
export const NO_LOCATION_FOUND = localize('sql.migration.no.location.found', "No location found");
export const NO_STORAGE_ACCOUNT_FOUND = localize('sql.migration.no.storageAccount.found', "No storage account found");
export const NO_FILESHARES_FOUND = localize('sql.migration.no.fileShares.found', "No file shares found");
export const NO_BLOBCONTAINERS_FOUND = localize('sql.migration.no.blobContainers.found', "No blob containers found");
export const INVALID_SUBSCRIPTION_ERROR = localize('sql.migration.invalid.subscription.error', "Please select a valid subscription to proceed.");
export const INVALID_LOCATION_ERROR = localize('sql.migration.invalid.location.error', "Please select a valid location to proceed.");
export const INVALID_STORAGE_ACCOUNT_ERROR = localize('sql.migration.invalid.storageAccount.error', "Please select a valid storage account to proceed.");
export const INVALID_FILESHARE_ERROR = localize('sql.migration.invalid.fileShare.error', "Please select a valid file share to proceed.");
export const INVALID_BLOBCONTAINER_ERROR = localize('sql.migration.invalid.blobContainer.error', "Please select a valid blob container to proceed.");
export const INVALID_NETWORK_SHARE_LOCATION = localize('sql.migration.invalid.network.share.location', "Invalid network share location format. Example: {0}", '\\\\Servername.domainname.com\\Backupfolder');
export const INVALID_USER_ACCOUNT = localize('sql.migration.invalid.user.account', "Invalid user account format. Example: {0}", 'Domain\\username');
export function TARGET_NETWORK_SHARE_LOCATION(dbName: string): string {
	return localize('sql.migration.network.share.location', "Network share location to read backups for database ‘{0}’", dbName);
}
export function TARGET_FILE_SHARE(dbName: string): string {
	return localize('sql.migration.file.share', "Select the file share that contains the backup files for ‘{0}’", dbName);
}
export function TARGET_BLOB_CONTAINER(dbName: string): string {
	return localize('sql.migration.blob.container', "Select the container that contains the backup files for ‘{0}’", dbName);
}
export const ENTER_NETWORK_SHARE_INFORMATION = localize('sql.migration.enter.network.share.information', "Enter target names for selected source database(s)");
export const ENTER_BLOB_CONTAINER_INFORMATION = localize('sql.migration.blob.container.information', "Enter the target name and select the blob container location for selected databases");
export const ENTER_FILE_SHARE_INFORMATION = localize('sql.migration.enter.file.share.information', "Enter the target name and select the file share location of selected databases");
export const INVALID_TARGET_NAME_ERROR = localize('sql.migration.invalid.target.name.error', "Please enter a valid name for the target database.");
export const PROVIDE_UNIQUE_CONTAINERS = localize('sql.migration.provide.unique.containers', "Please provide unique containers for target databases. Databases affected: ");
export function SQL_SOURCE_DETAILS(authMethod: MigrationSourceAuthenticationType, serverName: string): string {
	switch (authMethod) {
		case MigrationSourceAuthenticationType.Integrated:
			return localize('sql.migration.source.details.windowAuth', "Enter the Windows Authentication credential used for connecting to SQL Server Instance {0}. ​ This credential will be used to for connecting to SQL Server instance and identifying valid backup file(s)", serverName);
		case MigrationSourceAuthenticationType.Sql:
			return localize('sql.migration.source.details.sqlAuth', "Enter the SQL Authentication credential used for connecting to SQL Server Instance {0}. ​ This credential will be used to for connecting to SQL Server instance and identifying valid backup file(s)", serverName);
	}
}

// integration runtime page
export const IR_PAGE_TITLE = localize('sql.migration.ir.page.title', "Azure Database Migration Service");
export const IR_PAGE_DESCRIPTION = localize('sql.migration.ir.page.description', "Azure Database Migration Service (DMS) orchestrates database migration activities and tracks their progress. You can select an existing DMS for Azure SQL target if you have created one previously or create a new one below.");
export const IR_PAGE_NOTE = localize('sql.migration.ir.page.note', "Note: DMS will run in your Azure subscription in the chosen resource group and does not incur any cost for running it.");
export const SELECT_A_SQL_MIGRATION_SERVICE = localize('sql.migration.select.a.migration.service', "Select Azure Database Migration Service");
export const DEFAULT_SETUP_BUTTON = localize('sql.migration.default.setup.button', "Setup with defaults: Add DMS with one click express setup using default options.");
export const CUSTOM_SETUP_BUTTON = localize('sql.migration.custom.setup.button', "Custom setup: Add DMS after customizing most options.");
export const SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR = localize('sql.migration.ir.page.sql.migration.service.not.found', "No DMS found. Please create a new one");
export const CREATE_NEW = localize('sql.migration.create.new', "Create new");
export const INVALID_SERVICE_ERROR = localize('sql.migration.invalid.migration.service.error', "Please select a valid DMS");
export const SERVICE_OFFLINE_ERROR = localize('sql.migration.invalid.migration.service.offline.error', "Please select a DMS that is connected to a node");
export const AUTHENTICATION_KEYS = localize('sql.migration.authentication.types', "Authentication Keys");
export function SQL_MIGRATION_SERVICE_DETAILS_HEADER(sqlMigrationServiceName: string) {
	return localize('sql.migration.service.header', "Azure Database Migration Service \"{0}\" details:`", sqlMigrationServiceName);
}
export const DMS_PORTAL_INFO = localize('sql.migration.dms.portal.info', "Please note that any existing Azure Database Migration Service (DMS) in Azure portal will not show up in Azure Data Studio. DMS created in Azure Data Studio will not be visible in Azure portal yet.");

// create migration service dialog
export const CREATE_MIGRATION_SERVICE_TITLE = localize('sql.migration.services.dialog.title', "Create Azure Database Migration Service");
export const MIGRATION_SERVICE_DIALOG_DESCRIPTION = localize('sql.migration.services.container.description', "Enter the information below to add a new Azure Database Migration Service.");
export const LOADING_MIGRATION_SERVICES = localize('sql.migration.service.container.loading.help', "Loading Migration Services");
export const SERVICE_CONTAINER_HEADING = localize('sql.migration.service.container.heading', "Setup Integration Runtime");
export const SERVICE_CONTAINER_DESCRIPTION1 = localize('sql.migration.service.container.container.description1', "Azure Database Migration Service leverages Azure Data Factory's Self-hosted Integration Runtime to upload backups from on-premise network fie share to Azure.");
export const SERVICE_CONTAINER_DESCRIPTION2 = localize('sql.migration.service.container.container.description2', "Follow the instructions below to setup self-hosted Integration Runtime.");
export const SERVICE_STEP1 = localize('sql.migration.ir.setup.step1', "Step 1: {0}");
export const SERVICE_STEP1_LINK = localize('sql.migration.option', "Download and install integration runtime");
export const SERVICE_STEP2 = localize('sql.migration.ir.setup.step2', "Step 2: Use this key to register your integration runtime");
export const SERVICE_STEP3 = localize('sql.migration.ir.setup.step3', "Step 3: Click on 'Test connection' button to check the connection between Azure Database Migration Service and Integration Runtime");
export const SERVICE_CONNECTION_STATUS = localize('sql.migration.connection.status', "Connection Status");
export const SERVICE_KEY1_LABEL = localize('sql.migration.key1.label', "Key 1");
export const SERVICE_KEY2_LABEL = localize('sql.migration.key2.label', "Key 2");
export const SERVICE_KEY_COPIED_HELP = localize('sql.migration.key.copied', "Key copied");
export const REFRESH_KEYS = localize('sql.migration.refresh.keys', "Refresh keys");
export const COPY_KEY = localize('sql.migration.copy.key', "Copy key");
export const AUTH_KEY_COLUMN_HEADER = localize('sql.migration.authkeys.header', "Authentication key");
export function AUTH_KEY_REFRESHED(keyName: string): string {
	return localize('sql.migration.authkeys.refresh.message', "Authentication key '{0}' has been refreshed.", keyName);
}
export function SERVICE_NOT_READY(serviceName: string): string {
	return localize('sql.migration.service.not.ready', "Azure Database Migration Service is not registered. Azure Database Migration Service '{0}' needs to be registered with self-hosted Integration Runtime on any node.", serviceName);
}
export function SERVICE_READY(serviceName: string, host: string): string {
	return localize('sql.migration.service.ready', "Azure Database Migration Service '{0}' is connected to self-hosted Integration Runtime running on the node - {1}", serviceName, host);
}
export const RESOURCE_GROUP_NOT_FOUND = localize('sql.migration.resource.group.not.found', "No resource groups found");
export const INVALID_RESOURCE_GROUP_ERROR = localize('sql.migration.invalid.resourceGroup.error', "Please select a valid resource group to proceed.");
export const INVALID_REGION_ERROR = localize('sql.migration.invalid.region.error', "Please select a valid location to proceed.");
export const INVALID_SERVICE_NAME_ERROR = localize('sql.migration.invalid.service.name.error', "Please enter a valid name for the Migration Service.");
export const SERVICE_NOT_FOUND = localize('sql.migration.service.not.found', "No Migration Services found. Please create a new one.");
export const SERVICE_NOT_SETUP_ERROR = localize('sql.migration.service.not.setup', "Please add a Migration Service to proceed.");
export const MANAGED_INSTANCE = localize('sql.migration.managed.instance', "Azure SQL managed instance");
export const NO_MANAGED_INSTANCE_FOUND = localize('sql.migration.no.managedInstance.found', "No managed instance found");
export const NO_VIRTUAL_MACHINE_FOUND = localize('sql.migration.no.virtualMachine.found', "No virtual machine found");
export const TARGET_SELECTION_PAGE_TITLE = localize('sql.migration.target.page.title', "Choose the target Azure SQL");
export const RESOURCE_GROUP_DESCRIPTION = localize('sql.migration.resource.group.description', "A resource group is a container that holds related resources for an Azure solution");
export const OK = localize('sql.migration.ok', "OK");
export function NEW_RESOURCE_GROUP(resourceGroupName: string): string {
	return localize('sql.migration.new.resource.group', "(new) {0}", resourceGroupName);
}
export const TEST_CONNECTION = localize('sql.migration.test.connection', "Test connection");
export const DATA_MIGRATION_SERVICE_CREATED_SUCCESSFULLY = localize('sql.migration.database.migration.service.created.successfully', "Database migration service has been created successfully");
export const DMS_PROVISIONING_FAILED = localize('sql.migration.dms.provision.failed', "Database migration service has failed to provision. Please try again after some time.");
export const APPLY = localize('sql.migration.apply', "Apply");
export const CREATING_RESOURCE_GROUP = localize('sql.migration.creating.rg.loading', "Creating resource group");
export const RESOURCE_GROUP_CREATED = localize('sql.migration.rg.created', "Resource group created");
export const NAME_OF_NEW_RESOURCE_GROUP = localize('sql.migration.name.of.new.rg', "Name of new Resource group");
// common strings
export const LEARN_MORE = localize('sql.migration.learn.more', "Learn more");
export const SUBSCRIPTION = localize('sql.migration.subscription', "Subscription");
export const STORAGE_ACCOUNT = localize('sql.migration.storage.account', "Storage Account");
export const RESOURCE_GROUP = localize('sql.migration.resourceGroups', "Resource group");
export const REGION = localize('sql.migration.region', "Region");
export const NAME = localize('sql.migration.name', "Name");
export const LOCATION = localize('sql.migration.location', "Location");
export const NEW = localize('sql.migration.new', "New");
export const FEATURE_NOT_AVAILABLE = localize('sql.migration.feature.not.available', "This feature is not available yet.");
export const REFRESH = localize('sql.migration.refresh', "Refresh");
export const SUBMIT = localize('sql.migration.submit', "Submit");
export const CREATE = localize('sql.migration.create', "Create");
export const CANCEL = localize('sql.migration.cancel', "Cancel");
export const TYPE = localize('sql.migration.type', "Type");
export const PATH = localize('sql.migration.path', "Path");
export const USER_ACCOUNT = localize('sql.migration.path.user.account', "User Account");
export const VIEW_ALL = localize('sql.migration.view.all', "View All");
export const TARGET = localize('sql.migration.target', "Target");
export const AZURE_SQL = localize('sql.migration.azure.sql', "Azure SQL");
export const CLOSE = localize('sql.migration.close', "Close");
export const DATA_UPLOADED = localize('sql.migraiton.data.uploaded.size', "Data Uploaded/Size");
export const COPY_THROUGHPUT = localize('sql.migration.copy.throughput', "Copy Throughput (MBPS)");


//Summary Page
export const SUMMARY_PAGE_TITLE = localize('sql.migration.summary.page.title', "Summary");
export const AZURE_ACCOUNT_LINKED = localize('sql.migration.summary.azure.account.linked', "Azure account linked");
export const MIGRATION_TARGET = localize('sql.migration.summary.migration.target', "Migration target");
export const SUMMARY_MI_TYPE = localize('sql.migration.summary.mi.type', "Azure SQL Managed Instance");
export const SUMMARY_VM_TYPE = localize('sql.migration.summary.vm.type', "SQL Server on Azure Virtual Machine");
export const SUMMARY_DATABASE_COUNT_LABEL = localize('sql.migration.summary.database.count', "Database(s) to be migrated");
export const SUMMARY_AZURE_STORAGE_SUBSCRIPTION = localize('sql.migration.summary.azure.storage.subscription', "Azure storage subscription");
export const SUMMARY_AZURE_STORAGE = localize('sql.migration.summary.azure.storage', "Azure storage");
export const SUMMARY_IR_NODE = localize('sql.migration.ir.node', "Integration Runtime node");
export const NETWORK_SHARE = localize('sql.migration.network.share', "Network Share");
export const BLOB_CONTAINER = localize('sql.migration.blob.container.title', "Blob Container");
export const BLOB_CONTAINER_RESOURCE_GROUP = localize('sql.migration.blob.container.label', "Blob container resource group");
export const BLOB_CONTAINER_STORAGE_ACCOUNT = localize('sql.migration.blob.container.storage.account.label', "Blob container storage account");
export const FILE_SHARE = localize('sql.migration.file.share.title', "File Share");
export const MIGRATION_STARTED = localize('sql.migration.started.notification', "Migration in progress");
export const SOURCE_DATABASES = localize('sql.migration.source.databases', "Source Database(s)");
export const MODE = localize('sql.migration.mode', "Mode");
export const BACKUP_LOCATION = localize('sql.migration.backup.location', "Backup Location");
export const AZURE_STORAGE_ACCOUNT_TO_UPLOAD_BACKUPS = localize('sql.migration.azure.storage.account.to.upload.backups', "Azure Storage Account to Upload Backups");
export const SHIR = localize('sql.migration.shir', "Self-hosted Integration Runtime node");
export const TARGET_NAME = localize('sql.migration.summary.target.name', "Target Databases:");
export const DATABASE_TO_BE_MIGRATED = localize('sql.migration.database.to.be.migrated', "Database to be migrated");
export function COUNT_DATABASES(count: number): string {
	return (count === 1) ? localize('sql.migration.count.database.single', "{0} database", count) : localize('sql.migration.count.database.multiple', "{0} databases", count);
}

// Open notebook quick pick string
export const NOTEBOOK_QUICK_PICK_PLACEHOLDER = localize('sql.migration.quick.pick.placeholder', "Select the operation you'd like to perform");
export const NOTEBOOK_INLINE_MIGRATION_TITLE = localize('sql.migration.inline.migration.notebook.title', "Inline migration");
export const NOTEBOOK_SQL_MIGRATION_ASSESSMENT_TITLE = localize('sql.migration.sql.assessment.notebook.title', "SQL migration assessment");
export const NOTEBOOK_OPEN_ERROR = localize('sql.migration.notebook.open.error', "Error opening migration notebook");

// Dashboard
export const DASHBOARD_TITLE = localize('sql.migration.dashboard.title', "Azure SQL Migration");
export const DASHBOARD_DESCRIPTION = localize('sql.migration.dashboard.description', "Determine the migration readiness of your SQL Server instances, identify a recommended Azure SQL target, and complete the migration of your SQL Server instance to Azure SQL Managed Instance or SQL Server on Azure Virtual Machines.");
export const DASHBOARD_MIGRATE_TASK_BUTTON_TITLE = localize('sql.migration.dashboard.migrate.task.button', "Migrate to Azure SQL");
export const DASHBOARD_MIGRATE_TASK_BUTTON_DESCRIPTION = localize('sql.migration.dashboard.migrate.task.button.description', "Migrate SQL Server instance to Azure SQL.");
export const DATABASE_MIGRATION_STATUS = localize('sql.migration.database.migration.status', "Database Migration Status");
export const HELP_VIDEO1_TITLE = localize('sql.migration.dashboard.video1.title', "Migrate SQL Server to SQL Managed Instance");
export const HELP_VIDEO2_TITLE = localize('sql.migration.dashboard.video2.title', "Migrate SQL Server to SQL Virtual Machine");
export const HELP_LINK1_TITLE = localize('sql.migration.dashboard.link1.title', "Assessment rules for Azure SQL Managed Instance");
export const HELP_LINK1_DESCRIPTION = localize('sql.migration.dashboard.link1.description', "See the list of rules used to assess the feasibility of migrating your SQL Server to Azure SQL Managed Instance.");
export const HELP_TITLE = localize('sql.migration.dashboard.help.title', "Help Articles and Video Links");
export const PRE_REQ_TITLE = localize('sql.migration.pre.req.title', "Things you need before starting migration:");
export const PRE_REQ_1 = localize('sql.migration.pre.req.1', "Azure account details");
export const PRE_REQ_2 = localize('sql.migration.pre.req.2', "Azure SQL Managed Instance or SQL Server on Azure Virtual Machine");
export const PRE_REQ_3 = localize('sql.migration.pre.req.3', "Backup location details");
export const MIGRATION_IN_PROGRESS = localize('sql.migration.migration.in.progress', "Database migration in progress");
export const MIGRATION_FAILED = localize('sql.migration.failed', "Migration failed");
export const LOG_SHIPPING_IN_PROGRESS = localize('sql.migration.log.shipping.in.progress', "Log shipping in progress");
export const MIGRATION_COMPLETED = localize('sql.migration.migration.completed', "Migration completed");
export const MIGRATION_CUTOVER_CARD = localize('sql.migration.cutover.card', "Completing cutover");
export const SUCCESSFULLY_MIGRATED_TO_AZURE_SQL = localize('sql.migration.successfully.migrated.to.azure.sql', "Successfully migrated to Azure SQL");
export const MIGRATION_NOT_STARTED = localize('sql.migration.migration.not.started', "Migration not started");
export const CHOOSE_TO_MIGRATE_TO_AZURE_SQL = localize('sql.migration.choose.to.migrate.to.azure.sql', "Choose to migrate to Azure SQL");
export const COMING_SOON = localize('sql.migration.coming.soon', "Coming soon");
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

// Azure APIs
export const EASTUS2EUAP = localize('sql.migration.eastus2euap', 'East US 2 EUAP');

//Migration cutover dialog
export const MIGRATION_CUTOVER = localize('sql.migration.cutover', "Migration cutover");
export const COMPLETE_CUTOVER = localize('sql.migration.complete.cutover', "Complete cutover");
export const SOURCE_DATABASE = localize('sql.migration.source.database', "Source database name");
export const SOURCE_SERVER = localize('sql.migration.source.server', "Source server");
export const SOURCE_VERSION = localize('sql.migration.source.version', "Source version");
export const TARGET_DATABASE_NAME = localize('sql.migration.target.database.name', "Target database name");
export const TARGET_SERVER = localize('sql.migration.target.server', "Target server");
export const TARGET_VERSION = localize('sql.migration.target.version', "Target version");
export const MIGRATION_STATUS = localize('sql.migration.migration.status', "Migration status");
export const MIGRATION_STATUS_FILTER = localize('sql.migration.migration.status.filter', "Migration status filter");
export const FULL_BACKUP_FILES = localize('sql.migration.full.backup.files', "Full backup files");
export const LAST_APPLIED_LSN = localize('sql.migration.last.applied.lsn', "Last applied LSN");
export const LAST_APPLIED_BACKUP_FILES = localize('sql.migration.last.applied.backup.files', "Last applied backup files");
export const LAST_APPLIED_BACKUP_FILES_TAKEN_ON = localize('sql.migration.last.applied.files.taken.on', "Last applied backup files taken on");
export const ACTIVE_BACKUP_FILES = localize('sql.migration.active.backup.files', "Active Backup files");
export const STATUS = localize('sql.migration.status', "Status");
export const BACKUP_START_TIME = localize('sql.migration.backup.start.time', "Backup start time");
export const FIRST_LSN = localize('sql.migration.first.lsn', "First LSN");
export const LAST_LSN = localize('sql.migration.last.LSN', "Last LSN");
export const CANNOT_START_CUTOVER_ERROR = localize('sql.migration.cannot.start.cutover.error', "Cannot start the cutover process until all the migrations are done. Click refresh to fetch the latest file status");
export const AZURE_SQL_DATABASE_MANAGED_INSTANCE = localize('sql.migration.azure.sql.database.managed.instance', "Azure SQL Database Managed Instance");
export const AZURE_SQL_DATABASE_VIRTUAL_MACHINE = localize('sql.migration.azure.sql.database.virtual.machine', "Azure SQL Database Virtual Machine");
export const CANCEL_MIGRATION = localize('sql.migration.cancel.migration', "Cancel migration");
export function ACTIVE_BACKUP_FILES_ITEMS(fileCount: number) {
	if (fileCount === 1) {
		return localize('sql.migration.active.backup.files.items', "Active Backup files (1 item)");
	} else {
		return localize('sql.migration.active.backup.files.multiple.items', "Active Backup files ({0} items)", fileCount);
	}
}
export const COPY_MIGRATION_DETAILS = localize('sql.migration.copy.migration.details', "Copy Migration Details");
export const DETAILS_COPIED = localize('sql.migration.details.copied', "Details copied");
export const CANCEL_MIGRATION_CONFIRMATION = localize('sql.cancel.migration.confirmation', "Are you sure you want to cancel this migration?");
export const YES = localize('sql.migration.yes', "Yes");
export const NO = localize('sql.migration.no', "No");

//Migration confirm cutover dialog
export const COMPLETING_CUTOVER_WARNING = localize('sql.migration.completing.cutover.warning', "Completing cutover without restoring all the backup(s) may result in loss of data.");
export const BUSINESS_CRITICAL_INFO = localize('sql.migration.bc.info', "Managed Instance migration cutover for Business Critical service tier can take significantly longer than General Purpose as three secondary replicas have to be seeded for Always On High Availability group. This operation duration depends on the size of data. Seeding speed in 90% of cases is 220 GB/hour or higher.");
export const CUTOVER_HELP_MAIN = localize('sql.migration.cutover.help.main', "When you are ready to do the migration cutover, perform the following steps to complete the database migration. Please note that the database is ready for cutover only after a full backup has been restored on the target Azure SQL Database Managed Instance.");
export const CUTOVER_HELP_STEP1 = localize('sql.migration.cutover.step.1', "1. Stop all the incoming transactions coming to the source database.");
export const CUTOVER_HELP_STEP2 = localize('sql.migration.cutover.step.2', "2. Take final transaction log backup and provide it in the network share location.");
export const CUTOVER_HELP_STEP3 = localize('sql.migration.cutover.step.3', "3. Make sure all the log backups are restored on target database. The \"Log backups(s) pending restore\" should be zero.");
export function PENDING_BACKUPS(count: number): string {
	return localize('sql.migartion.cutover.pending.backup', "Pending log backups: {0}", count);
}
export const CONFIRM_CUTOVER_CHECKBOX = localize('sql.migration.confirm.checkbox.message', "I confirm there are no additional log backup(s) to provide and want to complete cutover.");
export function CUTOVER_IN_PROGRESS(dbName: string): string {
	return localize('sql.migration.cutover.in.progress', "Cutover in progress for database '{0}'", dbName);
}
//Migration status dialog
export const SEARCH_FOR_MIGRATIONS = localize('sql.migration.search.for.migration', "Search for migrations");
export const ONLINE = localize('sql.migration.online', "Online");
export const OFFLINE = localize('sql.migration.offline', "Offline");
export const DATABASE = localize('sql.migration.database', "Database");
export const DATABASE_MIGRATION_SERVICE = localize('sql.migration.database.migration.service', "Database Migration Service");
export const DURATION = localize('sql.migration.duration', "Duration");
export const AZURE_SQL_TARGET = localize('sql.migration.azure.sql.target', "Azure SQL Target");
export const SQL_MANAGED_INSTANCE = localize('sql.migration.sql.managed.instance', "SQL Managed Instance");
export const SQL_VIRTUAL_MACHINE = localize('sql.migration.sql.virtual.machine', "SQL Virtual Machine");
export const TARGET_AZURE_SQL_INSTANCE_NAME = localize('sql.migration.target.azure.sql.instance.name', "Azure SQL Target Name");
export const MIGRATION_MODE = localize('sql.migration.cutover.type', "Migration Mode");
export const START_TIME = localize('sql.migration.start.time', "Start Time");
export const FINISH_TIME = localize('sql.migration.finish.time', "Finish Time");
export function STATUS_WARNING_COUNT(status: string, count: number): string {
	if (status === 'InProgress' || status === 'Creating' || status === 'Completing' || status === 'Creating') {
		switch (count) {
			case 0:
				return localize('sql.migration.status.warning.count.none', "{0}", status);
			case 1:
				return localize('sql.migration.status.warning.count.single', "{0} ({1} Warning)", status, count);
			default:
				return localize('sql.migration.status.warning.count.multiple', "{0} ({1} Warnings)", status, count);
		}
	} else {
		switch (count) {
			case 0:
				return localize('sql.migration.status.error.count.none', "{0}", status);
			case 1:
				return localize('sql.migration.status.error.count.single', "{0} ({1} Error)", status, count);
			default:
				return localize('sql.migration.status.error.count.multiple', "{0} ({1} Errors)", status, count);
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

// SQL Migration Service Details page.
export const SQL_MIGRATION_SERVICE_DETAILS_SUB_TITLE = localize('sql.migration.service.details.dialog.title', "Azure Database Migration Service");
export const SQL_MIGRATION_SERVICE_DETAILS_BUTTON_LABEL = localize('sql.migration.service.details.button.label', "Close");
export const SQL_MIGRATION_SERVICE_DETAILS_IR_LABEL = localize('sql.migration.service.details.ir.label', "Self-hosted Integration Runtime node");
export const SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_LABEL = localize('sql.migration.service.details.authkeys.label', "Authentication keys");
export const SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_TITLE = localize('sql.migration.service.details.authkeys.title', "Authentication keys used to connect to the Self-hosted Integration Runtime node");
export const SQL_MIGRATION_SERVICE_DETAILS_STATUS_UNAVAILABLE = localize('sql.migration.service.details.status.unavailable', "-- unavailable --");

//Source Credentials page.
export const SOURCE_CONFIGURATION = localize('sql.migration.source.configuration', "Source Configuration");
export const SOURCE_CREDENTIALS = localize('sql.migration.source.credentials', "Source Credentials");
export const ENTER_YOUR_SQL_CREDS = localize('sql.migration.enter.your.sql.cred', "Enter the credential for source SQL Server instance. This credential will be used while migrating database(s) to Azure SQL.");
export const SERVER = localize('sql.migration.server', "Server");
export const USERNAME = localize('sql.migration.username', "Username");

//Assessment Dialog
export const ISSUES = localize('sql.migration.issues', "Issues");
export const SEARCH = localize('sql.migration.search', "Search");
export const INSTANCE = localize('sql.migration.instance', "Instance");
export const WARNINGS = localize('sql.migration.warnings', "Warnings");
export const IMPACTED_OBJECTS = localize('sql.migration.impacted.objects', "Impacted Objects");
export const OBJECT_DETAILS = localize('sql.migration.object.details', "Object details");
export const ASSESSMENT_RESULTS = localize('sql.migration.assessmen.results', "Assessment Results");
export const TYPES_LABEL = localize('sql.migration.type.label', "Type:");
export const NAMES_LABEL = localize('sql.migration.name.label', "Names:");
export const DESCRIPTION = localize('sql.migration.description', "Description");
export const RECOMMENDATION = localize('sql.migration.recommendation', "Recommendation");
export const MORE_INFO = localize('sql.migration.more.info', "More Info");
export const TARGET_PLATFORM = localize('sql.migration.target.platform', "Target Platform");
export const WARNINGS_DETAILS = localize('sql.migration.warnings.details', "Warnings Details");
export const ISSUES_DETAILS = localize('sql.migration.issues.details', "Issue Details");
export const SELECT_DB_PROMPT = localize('sql.migration.select.prompt', "Click on SQL Server Instance or any of the databases on the left to view its details.");
export const NO_ISSUES_FOUND_VM = localize('sql.migration.no.issues.vm', "No issues found for migrating to SQL Server on Azure Virtual Machine");
export const NO_ISSUES_FOUND_MI = localize('sql.migration.no.issues.mi', "No issues found for migrating to SQL Server on Azure SQL Managed Instance");
export function IMPACT_OBJECT_TYPE(objectType?: string): string {
	return objectType ? localize('sql.migration.impact.object.type', "Type: {0}", objectType) : '';
}
export function IMPACT_OBJECT_NAME(objectName?: string): string {
	return objectName ? localize('sql.migration.impact.object.name', "Name: {0}", objectName) : '';
}
export function DATABASES(selectedCount: number, totalCount: number): string {
	return localize('sql.migration.databases', "Databases ({0}/{1})", selectedCount, totalCount);
}
export function ISSUES_COUNT(totalCount: number): string {
	return localize('sql.migration.issues.count', "Issues ({0})", totalCount);
}
export function WARNINGS_COUNT(totalCount: number): string {
	return localize('sql.migration.warnings.count', "Warnings ({0})", totalCount);
}
export const AUTHENTICATION_TYPE = localize('sql.migration.authentication.type', "Authentication Type");
export const SQL_LOGIN = localize('sql.migration.sql.login', "SQL Login");
export const WINDOWS_AUTHENTICATION = localize('sql.migration.windows.auth', "Windows Authentication");

//AutoRefresh
export function AUTO_REFRESH_BUTTON_TEXT(interval: SupportedAutoRefreshIntervals): string {
	switch (interval) {
		case -1:
			return localize('sql.migration.auto.refresh.off', 'Auto Refresh: Off');
		case 15000:
			return localize('sql.migration.auto.refresh.15.seconds', 'Auto refresh: 15 seconds');
		case 30000:
			return localize('sql.migration.auto.refresh.30.seconds', 'Auto refresh: 30 seconds');
		case 60000:
			return localize('sql.migration.auto.refresh.1.min', 'Auto refresh: 1 minute');
		case 180000:
			return localize('sql.migration.auto.refresh.3.min', 'Auto refresh: 3 minutes');
		case 300000:
			return localize('sql.migration.auto.refresh.5.min', 'Auto refresh: 5 minutes');
	}
}

export const SELECT_THE_REFRESH_INTERVAL = localize('sql.migration.select.the.refresh.interval', "Select the refresh interval");
export const OFF = localize('sql.migration.off', "Off");
export const EVERY_30_SECOND = localize('sql.migration.every.30.second', "Every 30 seconds");
export const EVERY_1_MINUTE = localize('sql.migration.every.1.minute', "Every 1 minute");
export const EVERY_3_MINUTES = localize('sql.migration.every.3.minutes', "Every 3 minutes");
export const EVERY_5_MINUTES = localize('sql.migration.every.5.minutes', "Every 5 minutes");
