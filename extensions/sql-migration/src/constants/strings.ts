/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccount } from 'azurecore';
import * as nls from 'vscode-nls';
import { EOL } from 'os';
import { MigrationStatus } from '../models/migrationLocalStorage';
import { MigrationSourceAuthenticationType } from '../models/stateMachine';
const localize = nls.loadMessageBundle();


// #region wizard
export function WIZARD_TITLE(instanceName: string): string {
	return localize('sql-migration.wizard.title', "Migrate '{0}' to Azure SQL", instanceName);
}
// //#endregion

// Resume Migration Dialog
export const RESUME_TITLE = localize('sql.migration.resume.title', "Run migration workflow again");
export const START_MIGRATION = localize('sql.migration.resume.start', "Start with migration assessment again (recommended)");
export const CONTINUE_MIGRATION = localize('sql.migration.resume.continue', "Continue last migration attempt...");

// Assessments Progress Page
export const ASSESSMENT_BLOCKING_ISSUE_TITLE = localize('sql.migration.assessments.blocking.issue', 'This is a blocking issue that will prevent the database migration from succeeding.');
export const ASSESSMENT_IN_PROGRESS = localize('sql.migration.assessment.in.progress', "Assessment in progress");
export function ASSESSMENT_IN_PROGRESS_CONTENT(dbName: string) {
	return localize('sql.migration.assessment.in.progress.content', "We are assessing the databases in your SQL Server instance {0} to identify the right Azure SQL target.\n\nThis may take some time.", dbName);
}

export const SKU_RECOMMENDATION_PAGE_TITLE = localize('sql.migration.wizard.sku.title', "Azure SQL target");
export const SKU_RECOMMENDATION_ALL_SUCCESSFUL = (databaseCount: number): string => {
	return localize('sql.migration.wizard.sku.all', "Based on the assessment results, all {0} of your databases in an online state can be migrated to Azure SQL.", databaseCount);
};
export const SKU_RECOMMENDATION_ERROR = localize('sql.migration.wizard.sku.error', "An error occurred while assessing your databases.");
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
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR_BYPASS = localize('sql.migration.wizard.sku.assessment.error.bypass', 'Check this option to skip assessment and continue the migration.');
export const SKU_RECOMMENDATION_ASSESSMENT_ERROR_DETAIL = localize('sql.migration.wizard.sku.assessment.error.detail', '[There are no assessment results to validate readiness of your database migration. By checking this box, you acknowledge you want to proceed migrating your database to the desired Azure SQL target.]',);
export const REFRESH_ASSESSMENT_BUTTON_LABEL = localize('sql.migration.refresh.assessment.button.label', "Refresh assessment");
export const SKU_RECOMMENDATION_CHOOSE_A_TARGET = localize('sql.migration.wizard.sku.choose_a_target', "Choose your Azure SQL target");
export const SKU_RECOMMENDATION_SUBSCRIPTION_INFO = localize('sql.migration.sku.subscription', "Subscription name for your Azure SQL target");
export const SKU_RECOMMENDATION_LOCATION_INFO = localize('sql.migration.sku.location', "Azure region for your Azure SQL target");
export const SKU_RECOMMENDATION_RESOURCE_GROUP_INFO = localize('sql.migration.sku.resource_group', "Resource group for your Azure SQL target");
export const SKU_RECOMMENDATION_RESOURCE_INFO = localize('sql.migration.sku.resource', "Your Azure SQL target resource name");
export const SKU_RECOMMENDATION_MI_CARD_TEXT = localize('sql.migration.sku.mi.card.title', "Azure SQL Managed Instance (PaaS)");
export const SKU_RECOMMENDATION_VM_CARD_TEXT = localize('sql.migration.sku.vm.card.title', "SQL Server on Azure Virtual Machine (IaaS)");
export const SELECT_AZURE_MI = localize('sql.migration.select.azure.mi', "Select your target Azure subscription and your target Azure SQL Managed Instance.");
export const SELECT_AZURE_VM = localize('sql.migration.select.azure.vm', "Select your target Azure Subscription and your target SQL Server on Azure Virtual Machine for your target.");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI = localize('sql.migration.sku.recommendation.view.assessment.mi', "To migrate to Azure SQL Managed Instance (PaaS), view assessment results and select one or more databases.");
export const SKU_RECOMMENDATION_VIEW_ASSESSMENT_VM = localize('sql.migration.sku.recommendation.view.assessment.vm', "To migrate to SQL Server on Azure Virtual Machine (IaaS), view assessment results and select one or more databases.");
export const VIEW_SELECT_BUTTON_LABEL = localize('sql.migration.view.select.button.label', "View/Select");
export function TOTAL_DATABASES_SELECTED(selectedDbCount: number, totalDbCount: number): string {
	return localize('total.databases.selected', "{0} of {1} databases selected.", selectedDbCount, totalDbCount);
}
export const SELECT_TARGET_TO_CONTINUE = localize('sql.migration.select.target.to.continue', "To continue, select a target database.");
export const SELECT_DATABASE_TO_MIGRATE = localize('sql.migration.select.database.to.migrate', "Select the databases to migrate.");
export const ASSESSMENT_COMPLETED = (serverName: string): string => {
	return localize('sql.migration.generic.congratulations', "We have completed the assessment of your SQL Server instance '{0}'.", serverName);
};
export const ASSESSMENT_FAILED = (serverName: string): string => {
	return localize('sql.migration.asessment.failed', "The assessment of your SQL Server instance '{0}' failed.", serverName);
};
export function ASSESSMENT_TILE(serverName: string): string {
	return localize('sql.migration.assessment', "Assessment results for '{0}'", serverName);
}
export function CAN_BE_MIGRATED(eligibleDbs: number, totalDbs: number): string {
	return localize('sql.migration.can.be.migrated', "{0} out of {1} databases can be migrated", eligibleDbs, totalDbs);
}
export const ASSESSMENT_MIGRATION_WARNING = localize('sql.migration.assessment.migration.warning', "Databases that are not ready for migration to Azure SQL Managed Instance can be migrated to SQL Server on Azure Virtual Machines.");
export const DATABASES_TABLE_TILE = localize('sql.migration.databases.table.title', "Databases");
export const SQL_SERVER_INSTANCE = localize('sql.migration.sql.server.instance', "SQL Server instance");

// Accounts page
export const ACCOUNTS_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.account.title', "Azure account");
export const ACCOUNTS_SELECTION_PAGE_DESCRIPTION = localize('sql.migration.wizard.account.description', "Select an Azure account linked to Azure Data Studio, or link one now.");
export const ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR = localize('sql.migration.wizard.account.noAccount.error', "Add a linked account and then try again.");
export const ACCOUNT_LINK_BUTTON_LABEL = localize('sql.migration.wizard.account.add.button.label', "Link account");
export function accountLinkedMessage(count: number): string {
	return count === 1 ? localize('sql.migration.wizard.account.count.single.message', '{0} account linked', count) : localize('sql.migration.wizard.account.count.multiple.message', '{0} accounts linked', count);
}
export const AZURE_TENANT = localize('sql.migration.azure.tenant', "Azure AD tenant");
export function ACCOUNT_STALE_ERROR(account: AzureAccount) {
	return localize(
		'azure.accounts.accountStaleError',
		"The access token for selected account '{0}' and tenant '{1}' is no longer valid. Select 'Link account' and refresh the account, or select a different account.",
		`${account?.displayInfo?.displayName} (${account?.displayInfo?.userId})`,
		`${account?.properties?.tenants[0]?.displayName} (${account?.properties?.tenants[0]?.userId})`);
}
export function ACCOUNT_ACCESS_ERROR(account: AzureAccount, error: Error) {
	return localize(
		'azure.accounts.accountAccessError',
		"An error occurred while accessing the selected account '{0}' and tenant '{1}'. Select 'Link account' and refresh the account, or select a different account. Error '{2}'",
		`${account?.displayInfo?.displayName} (${account?.displayInfo?.userId})`,
		`${account?.properties?.tenants[0]?.displayName} (${account?.properties?.tenants[0]?.userId})`,
		error.message);
}

// database backup page
export const DATABASE_BACKUP_PAGE_TITLE = localize('sql.migration.database.page.title', "Database backup");
export const DATABASE_BACKUP_PAGE_DESCRIPTION = localize('sql.migration.database.page.description', "Select the location of the database backups to use during migration.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL = localize('sql.migration.nc.network.share.radio.label', "My database backups are on a network share");
export const DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL = localize('sql.migration.nc.blob.storage.radio.label', "My database backups are in an Azure Storage Blob Container");
export const DATABASE_BACKUP_NETWORK_SHARE_HEADER_TEXT = localize('sql.migration.network.share.header.text', "Network share details");
export const DATABASE_BACKUP_NETWORK_SHARE_LOCATION_INFO = localize('sql.migration.network.share.location.info', "Network share path for your database backups. The migration process will automatically retrieve valid backup files from this network share.");
export const DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_INFO = localize('sql.migration.network.share.windows.user.info', "Windows user account with read access to the network share location.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT = localize('sql.migration.network.share.help.text', "Provide the network share location where the backups are stored, and the user credentials used to access the share.");
export const DATABASE_BACKUP_NETWORK_SHARE_TABLE_HELP_TEXT = localize('sql.migration.network.share.storage.table.help', "Enter target database name for the selected source databases.");
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
export const DATABASE_BACKUP_BLOB_STORAGE_HEADER_TEXT = localize('sql.migration.blob.storage.header.text', "Azure Storage Blob Container details");
export const DATABASE_BACKUP_BLOB_STORAGE_HELP_TEXT = localize('sql.migration.blob.storage.help.text', "Provide the Azure Storage Blob Container that contains the backups.");
export const DATABASE_BACKUP_BLOB_STORAGE_TABLE_HELP_TEXT = localize('sql.migration.blob.storage.table.help', "Enter target database name and select resource group, storage account and container for the selected source databases.");
export const DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL = localize('sql.migration.blob.storage.subscription.label', "Subscription");
export const DATABASE_BACKUP_MIGRATION_MODE_LABEL = localize('sql.migration.database.migration.mode.label', "Migration mode");
export const DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION = localize('sql.migration.database.migration.mode.description', "To migrate to the Azure SQL target, choose a migration mode based on your downtime requirements.");
export const DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL = localize('sql.migration.database.migration.mode.online.label', "Online migration");
export const DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION = localize('sql.migration.database.migration.mode.online.description', "Application downtime is limited to cutover at the end of migration.");
export const DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL = localize('sql.migration.database.migration.mode.offline.label', "Offline migration");
export const DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION = localize('sql.migration.database.migration.mode.offline.description', "Application downtime will start when the migration starts.");
export const NETWORK_SHARE_PATH = localize('sql.migration.network.share.path', "\\\\Servername.domainname.com\\Backupfolder");
export const WINDOWS_USER_ACCOUNT = localize('sql.migration.windows.user.account', "Domain\\username");
export const NO_SUBSCRIPTIONS_FOUND = localize('sql.migration.no.subscription.found', "No subscription found.");
export const NO_LOCATION_FOUND = localize('sql.migration.no.location.found', "No location found.");
export const NO_STORAGE_ACCOUNT_FOUND = localize('sql.migration.no.storageAccount.found', "No storage account found.");
export const NO_FILESHARES_FOUND = localize('sql.migration.no.fileShares.found', "No file shares found.");
export const NO_BLOBCONTAINERS_FOUND = localize('sql.migration.no.blobContainers.found', "No blob containers found.");
export const NO_BLOBFILES_FOUND = localize('sql.migration.no.blobFiles.found', "No blob files found.");
export const INVALID_SUBSCRIPTION_ERROR = localize('sql.migration.invalid.subscription.error', "To continue, select a valid subscription.");
export const INVALID_LOCATION_ERROR = localize('sql.migration.invalid.location.error', "To continue, select a valid location.");
export const INVALID_STORAGE_ACCOUNT_ERROR = localize('sql.migration.invalid.storageAccount.error', "To continue, select a valid storage account.");
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
export const INVALID_NETWORK_SHARE_LOCATION = localize('sql.migration.invalid.network.share.location', "Invalid network share location format. Example: {0}", NETWORK_SHARE_PATH);
export const INVALID_USER_ACCOUNT = localize('sql.migration.invalid.user.account', "Invalid user account format. Example: {0}", WINDOWS_USER_ACCOUNT);
export const INVALID_TARGET_NAME_ERROR = localize('sql.migration.invalid.target.name.error', "Enter a valid name for the target database.");
export const PROVIDE_UNIQUE_CONTAINERS = localize('sql.migration.provide.unique.containers', "Provide a unique container for each target database. Databases affected: ");
export function SQL_SOURCE_DETAILS(authMethod: MigrationSourceAuthenticationType, serverName: string): string {
	switch (authMethod) {
		case MigrationSourceAuthenticationType.Integrated:
			return localize('sql.migration.source.details.windowAuth', "Enter the Windows Authentication credentials used to connect to SQL Server instance {0}. These credentials will be used to connect to the SQL Server instance and identify valid backup files.", serverName);
		case MigrationSourceAuthenticationType.Sql:
			return localize('sql.migration.source.details.sqlAuth', "Enter the SQL Authentication credentials used to connect to SQL Server instance {0}. ​These credentials will be used to connect to the SQL Server instance and identify valid backup files.", serverName);
	}
}
export const SELECT_RESOURCE_GROUP_PROMPT = localize('sql.migration.blob.resourceGroup.select.prompt', "Select a resource group value first.");
export const SELECT_STORAGE_ACCOUNT = localize('sql.migration.blob.storageAccount.select', "Select a storage account value first.");
export const SELECT_BLOB_CONTAINER = localize('sql.migration.blob.container.select', "Select a blob container value first.");

// integration runtime page
export const SELECT_RESOURCE_GROUP = localize('sql.migration.blob.resourceGroup.select', "Select a resource group.");
export const IR_PAGE_TITLE = localize('sql.migration.ir.page.title', "Azure Database Migration Service");
export const IR_PAGE_DESCRIPTION = localize('sql.migration.ir.page.description', "Azure Database Migration Service orchestrates database migration activities and tracks their progress. You can select an existing Database Migration Service as an Azure SQL target if you have created one previously, or create a new one below.");
export const SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR = localize('sql.migration.ir.page.sql.migration.service.not.found', "No Database Migration Service found. Create a new one.");
export const CREATE_NEW = localize('sql.migration.create.new', "Create new");
export const INVALID_SERVICE_ERROR = localize('sql.migration.invalid.migration.service.error', "Select a valid Database Migration Service.");
export const SERVICE_OFFLINE_ERROR = localize('sql.migration.invalid.migration.service.offline.error', "Select a Database Migration Service that is connected to a node.");
export const AUTHENTICATION_KEYS = localize('sql.migration.authentication.types', "Authentication keys");
export function SQL_MIGRATION_SERVICE_DETAILS_HEADER(sqlMigrationServiceName: string) {
	return localize('sql.migration.service.header', "Azure Database Migration Service \"{0}\" details:`", sqlMigrationServiceName);
}
export const DMS_PORTAL_INFO = localize('sql.migration.dms.portal.info', "Any existing Azure Database Migration Service in the Azure portal do not appear in Azure Data Studio. Any Database Migration Service created in Azure Data Studio will not be visible in the Azure portal yet.");
export const DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS = localize('sql.migration.database.migration.service.authentication.keys', "Database Migration Service authentication keys");
// create migration service dialog
export const CREATE_MIGRATION_SERVICE_TITLE = localize('sql.migration.services.dialog.title', "Create Azure Database Migration Service");
export const MIGRATION_SERVICE_SUBSCRIPTION_INFO = localize('sql.migration.services.subscription', "Subscription name for your Azure Database Migration Service.");
export const MIGRATION_SERVICE_LOCATION_INFO = localize('sql.migration.services.location', "Azure region for your Azure Database Migration Service. This should be the same region as your target Azure SQL.");
export const MIGRATION_SERVICE_RESOURCE_GROUP_INFO = localize('sql.migration.services.resource.group', "Resource group for your Azure Database Migration Service.");
export const MIGRATION_SERVICE_NAME_INFO = localize('sql.migration.services.name', "Azure Database Migration Service name.");
export const MIGRATION_SERVICE_TARGET_INFO = localize('sql.migration.services.target', "Azure SQL target selected as default.");
export const MIGRATION_SERVICE_DIALOG_DESCRIPTION = localize('sql.migration.services.container.description', "Enter the information below to add a new Azure Database Migration Service.");
export const LOADING_MIGRATION_SERVICES = localize('sql.migration.service.container.loading.help', "Loading Migration Services");
export const SERVICE_CONTAINER_HEADING = localize('sql.migration.service.container.heading', "Setup integration runtime");
export const SERVICE_CONTAINER_DESCRIPTION1 = localize('sql.migration.service.container.container.description1', "Azure Database Migration Service leverages Azure Data Factory's self-hosted integration runtime to upload backups from on-premises network file share to Azure.");
export const SERVICE_CONTAINER_DESCRIPTION2 = localize('sql.migration.service.container.container.description2', "Follow the instructions below to setup self-hosted integration runtime.");
export const SERVICE_STEP1 = localize('sql.migration.ir.setup.step1', "Step 1: {0}");
export const SERVICE_STEP1_LINK = localize('sql.migration.option', "Download and install integration runtime");
export const SERVICE_STEP2 = localize('sql.migration.ir.setup.step2', "Step 2: Use this key to register your integration runtime");
export const SERVICE_STEP3 = localize('sql.migration.ir.setup.step3', "Step 3: Click on 'Test connection' button to check the connection between Azure Database Migration Service and integration runtime");
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
export function SERVICE_NOT_READY(serviceName: string): string {
	return localize('sql.migration.service.not.ready', "Azure Database Migration Service is not registered. Azure Database Migration Service '{0}' needs to be registered with self-hosted integration runtime on any node.", serviceName);
}
export function SERVICE_READY(serviceName: string, host: string): string {
	return localize('sql.migration.service.ready', "Azure Database Migration Service '{0}' is connected to self-hosted integration runtime running on the node - {1}", serviceName, host);
}
export const RESOURCE_GROUP_NOT_FOUND = localize('sql.migration.resource.group.not.found', "No resource groups found.");
export const INVALID_RESOURCE_GROUP_ERROR = localize('sql.migration.invalid.resourceGroup.error', " To continue, select a valid resource group.");
export const INVALID_SERVICE_NAME_ERROR = localize('sql.migration.invalid.service.name.error', "Enter a valid name for the Migration Service.");
export const SERVICE_NOT_FOUND = localize('sql.migration.service.not.found', "No Migration Services found. To continue, create a new one.");
export const SERVICE_STATUS_REFRESH_ERROR = localize('sql.migration.service.status.refresh.error', 'An error occurred while refreshing the migration service creation status.');
export const MANAGED_INSTANCE = localize('sql.migration.managed.instance', "Azure SQL Managed Instance");
export const NO_MANAGED_INSTANCE_FOUND = localize('sql.migration.no.managedInstance.found', "No managed instance found.");
export const NO_VIRTUAL_MACHINE_FOUND = localize('sql.migration.no.virtualMachine.found', "No virtual machine found.");
export const RESOURCE_GROUP_DESCRIPTION = localize('sql.migration.resource.group.description', "A resource group is a container that holds related resources for an Azure solution.");
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
export const NAME_OF_NEW_RESOURCE_GROUP = localize('sql.migration.name.of.new.rg', "Name of new resource group");
export const DATA_UPLOADED_INFO = localize('sql.migration.data.uploaded.info', "Comparison of the actual amount of data read from the source and the actual amount of data uploaded to the target.");
export const COPY_THROUGHPUT_INFO = localize('sql.migration.copy.throughput.info', "Data movement throughput achieved during the migration of your database backups to Azure. This is the rate of data transfer, calculated by data read divided by duration of backups migration to Azure.");
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
export const CREATE = localize('sql.migration.create', "Create");
export const CANCEL = localize('sql.migration.cancel', "Cancel");
export const TYPE = localize('sql.migration.type', "Type");
export const USER_ACCOUNT = localize('sql.migration.path.user.account', "User account");
export const VIEW_ALL = localize('sql.migration.view.all', "View all");
export const TARGET = localize('sql.migration.target', "Target");
export const AZURE_SQL = localize('sql.migration.azure.sql', "Azure SQL");
export const CLOSE = localize('sql.migration.close', "Close");
export const DATA_UPLOADED = localize('sql.migration.data.uploaded.size', "Data uploaded / size");
export const COPY_THROUGHPUT = localize('sql.migration.copy.throughput', "Copy throughput (MBPS)");
export const NEW_SUPPORT_REQUEST = localize('sql.migration.newSupportRequest', "New support request");
export const IMPACT = localize('sql.migration.impact', "Impact");
export const ALL_FIELDS_REQUIRED = localize('sql.migration.all.fields.required', 'All fields are required.');

//Summary Page
export const START_MIGRATION_TEXT = localize('sql.migration.start.migration.button', "Start migration");
export const SUMMARY_PAGE_TITLE = localize('sql.migration.summary.page.title', "Summary");
export const SUMMARY_MI_TYPE = localize('sql.migration.summary.mi.type', "Azure SQL Managed Instance");
export const SUMMARY_VM_TYPE = localize('sql.migration.summary.vm.type', "SQL Server on Azure Virtual Machine");
export const SUMMARY_DATABASE_COUNT_LABEL = localize('sql.migration.summary.database.count', "Databases for migration");
export const SUMMARY_AZURE_STORAGE_SUBSCRIPTION = localize('sql.migration.summary.azure.storage.subscription', "Azure storage subscription");
export const SUMMARY_AZURE_STORAGE = localize('sql.migration.summary.azure.storage', "Azure storage");
export const NETWORK_SHARE = localize('sql.migration.network.share', "Network share");
export const BLOB_CONTAINER = localize('sql.migration.blob.container.title', "Blob container");
export const BLOB_CONTAINER_LAST_BACKUP_FILE = localize('sql.migration.blob.container.last.backup.file.label', "Last backup file");
export const BLOB_CONTAINER_RESOURCE_GROUP = localize('sql.migration.blob.container.label', "Blob container resource group");
export const BLOB_CONTAINER_STORAGE_ACCOUNT = localize('sql.migration.blob.container.storage.account.label', "Blob container storage account");
export const SOURCE_DATABASES = localize('sql.migration.source.databases', "Source databases");
export const MODE = localize('sql.migration.mode', "Mode");
export const BACKUP_LOCATION = localize('sql.migration.backup.location', "Backup location");
export const AZURE_STORAGE_ACCOUNT_TO_UPLOAD_BACKUPS = localize('sql.migration.azure.storage.account.to.upload.backups', "Azure Storage account to upload backups");
export const SHIR = localize('sql.migration.shir', "Self-hosted integration runtime node");
export const DATABASE_TO_BE_MIGRATED = localize('sql.migration.database.to.be.migrated', "Database to be migrated");
export function COUNT_DATABASES(count: number): string {
	return (count === 1) ? localize('sql.migration.count.database.single', "{0} database", count) : localize('sql.migration.count.database.multiple', "{0} databases", count);
}

// Open notebook quick pick string
export const NOTEBOOK_QUICK_PICK_PLACEHOLDER = localize('sql.migration.quick.pick.placeholder', "Select the operation you'd like to perform.");
export const NOTEBOOK_INLINE_MIGRATION_TITLE = localize('sql.migration.inline.migration.notebook.title', "Inline migration");
export const NOTEBOOK_SQL_MIGRATION_ASSESSMENT_TITLE = localize('sql.migration.sql.assessment.notebook.title', "SQL migration assessment");
export const NOTEBOOK_OPEN_ERROR = localize('sql.migration.notebook.open.error', "Failed to open the migration notebook.");

// Dashboard
export const DASHBOARD_TITLE = localize('sql.migration.dashboard.title', "Azure SQL Migration");
export const DASHBOARD_DESCRIPTION = localize('sql.migration.dashboard.description', "Determine the migration readiness of your SQL Server instances, identify a recommended Azure SQL target, and complete the migration of your SQL Server instance to Azure SQL Managed Instance or SQL Server on Azure Virtual Machines.");
export const DASHBOARD_MIGRATE_TASK_BUTTON_TITLE = localize('sql.migration.dashboard.migrate.task.button', "Migrate to Azure SQL");
export const DASHBOARD_MIGRATE_TASK_BUTTON_DESCRIPTION = localize('sql.migration.dashboard.migrate.task.button.description', "Migrate a SQL Server instance to Azure SQL.");
export const DATABASE_MIGRATION_STATUS = localize('sql.migration.database.migration.status', "Database migration status");
export const HELP_LINK1_TITLE = localize('sql.migration.dashboard.link1.title', "Assessment rules for Azure SQL Managed Instance");
export const HELP_LINK1_DESCRIPTION = localize('sql.migration.dashboard.link1.description', "Assessment rules used to determine the feasibility of migrating your SQL Server instance to Azure SQL Managed Instance.");
export const HELP_TITLE = localize('sql.migration.dashboard.help.title', "Help articles and video links");
export const PRE_REQ_TITLE = localize('sql.migration.pre.req.title', "Things you need before starting a migration:");
export const PRE_REQ_1 = localize('sql.migration.pre.req.1', "Azure account details");
export const PRE_REQ_2 = localize('sql.migration.pre.req.2', "Azure SQL Managed Instance or SQL Server on Azure Virtual Machine");
export const PRE_REQ_3 = localize('sql.migration.pre.req.3', "Backup location details");
export const MIGRATION_IN_PROGRESS = localize('sql.migration.migration.in.progress', "Database migrations in progress");
export const MIGRATION_FAILED = localize('sql.migration.failed', "Migrations failed");
export const MIGRATION_COMPLETED = localize('sql.migration.migration.completed', "Migrations completed");
export const MIGRATION_CUTOVER_CARD = localize('sql.migration.cutover.card', "Completing cutover");
export const MIGRATION_NOT_STARTED = localize('sql.migration.migration.not.started', "Migrations not started");
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
export const ACTIVE_BACKUP_FILES = localize('sql.migration.active.backup.files', "Active backup files");
export const MIGRATION_STATUS_REFRESH_ERROR = localize('sql.migration.cutover.status.refresh.error', 'An error occurred while refreshing the migration status.');
export const MIGRATION_CANCELLATION_ERROR = localize('sql.migration.cancel.error', 'An error occurred while canceling the migration.');
export const STATUS = localize('sql.migration.status', "Status");
export const BACKUP_START_TIME = localize('sql.migration.backup.start.time', "Backup start time");
export const FIRST_LSN = localize('sql.migration.first.lsn', "First LSN");
export const LAST_LSN = localize('sql.migration.last.LSN', "Last LSN");
export const CANNOT_START_CUTOVER_ERROR = localize('sql.migration.cannot.start.cutover.error', "The cutover process cannot start until all the migrations are done. To return the latest file status, refresh your browser window.");
export const AZURE_SQL_DATABASE_MANAGED_INSTANCE = localize('sql.migration.azure.sql.database.managed.instance', "Azure SQL Managed Instance");
export const AZURE_SQL_DATABASE_VIRTUAL_MACHINE = localize('sql.migration.azure.sql.database.virtual.machine', "SQL Server on Azure Virtual Machines");
export const CANCEL_MIGRATION = localize('sql.migration.cancel.migration', "Cancel migration");
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
export const YES = localize('sql.migration.yes', "Yes");
export const NO = localize('sql.migration.no', "No");
export const EMPTY_TABLE_TEXT = localize('sql.migration.empty.table.text', "No backup files");
export const EMPTY_TABLE_SUBTEXT = localize('sql.migration.empty.table.subtext', "If results were expected, verify the connection to the SQL Server instance.");
export const MIGRATION_CUTOVER_ERROR = localize('sql.migration.cutover.error', 'An error occurred while initiating cutover.');

//Migration confirm cutover dialog
export const COMPLETING_CUTOVER_WARNING = localize('sql.migration.completing.cutover.warning', "Completing cutover without restoring all the backups may result in a data loss.");
export const BUSINESS_CRITICAL_INFO = localize('sql.migration.bc.info', "A SQL Managed Instance migration cutover to the Business Critical service tier can take significantly longer than General Purpose because three secondary replicas have to be seeded for Always On High Availability group. The duration of the operation depends on the size of the data. Seeding speed in 90% of cases is 220 GB/hour or higher.");
export const CUTOVER_HELP_MAIN = localize('sql.migration.cutover.help.main', "Perform the following steps before you complete cutover.");
export const CUTOVER_HELP_STEP1 = localize('sql.migration.cutover.step.1', "1. Stop all incoming transactions to the source database.");
export const CUTOVER_HELP_STEP2_NETWORK_SHARE = localize('sql.migration.cutover.step.2.network.share', "2. ​​Create a final transaction log backup and store it on the network share.");
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
export const MIGRATION_CANNOT_CUTOVER = localize('sql.migration.cannot.cutover', 'Migration is not in progress and cannot be cutover.');
export const FILE_NAME = localize('sql.migration.file.name', "File name");
export const SIZE_COLUMN_HEADER = localize('sql.migration.size.column.header', "Size");
export const NO_PENDING_BACKUPS = localize('sql.migration.no.pending.backups', "No pending backups. Click refresh to check current status.");
//Migration status dialog
export const ADD_ACCOUNT = localize('sql.migration.status.add.account', "Add account");
export const ADD_ACCOUNT_MESSAGE = localize('sql.migration.status.add.account.MESSAGE', "Add your Azure account to view existing migrations and their status.");
export const STATUS_ALL = localize('sql.migration.status.dropdown.all', "Status: All");
export const STATUS_ONGOING = localize('sql.migration.status.dropdown.ongoing', "Status: Ongoing");
export const STATUS_COMPLETING = localize('sql.migration.status.dropdown.completing', "Status: Completing");
export const STATUS_SUCCEEDED = localize('sql.migration.status.dropdown.succeeded', "Status: Succeeded");
export const STATUS_FAILED = localize('sql.migration.status.dropdown.failed', "Status: Failed");
export const SEARCH_FOR_MIGRATIONS = localize('sql.migration.search.for.migration', "Search for migrations");
export const ONLINE = localize('sql.migration.online', "Online");
export const OFFLINE = localize('sql.migration.offline', "Offline");
export const DATABASE = localize('sql.migration.database', "Database");
export const DATABASE_MIGRATION_SERVICE = localize('sql.migration.database.migration.service', "Database Migration Service");
export const DURATION = localize('sql.migration.duration', "Duration");
export const AZURE_SQL_TARGET = localize('sql.migration.azure.sql.target', "Target type");
export const SQL_MANAGED_INSTANCE = localize('sql.migration.sql.managed.instance', "SQL Managed Instance");
export const SQL_VIRTUAL_MACHINE = localize('sql.migration.sql.virtual.machine', "SQL Virtual Machine");
export const TARGET_AZURE_SQL_INSTANCE_NAME = localize('sql.migration.target.azure.sql.instance.name', "Target name");
export const MIGRATION_MODE = localize('sql.migration.cutover.type', "Migration mode");
export const START_TIME = localize('sql.migration.start.time', "Start time");
export const FINISH_TIME = localize('sql.migration.finish.time', "Finish time");

export function STATUS_VALUE(status: string, count: number): string {
	if (count > 0) {
		return localize('sql.migration.status.error.count.some', "{0} (", StatusLookup[status] ?? status);
	}
	return localize('sql.migration.status.error.count.none', "{0}", StatusLookup[status] ?? status);
}

export interface LookupTable<T> {
	[key: string]: T;
}

export const StatusLookup: LookupTable<string | undefined> = {
	['InProgress']: localize('sql.migration.status.inprogress', 'In progress'),
	['Succeeded']: localize('sql.migration.status.succeeded', 'Succeeded'),
	['Creating']: localize('sql.migration.status.creating', 'Creating'),
	['Completing']: localize('sql.migration.status.completing', 'Completing'),
	['Canceling']: localize('sql.migration.status.canceling', 'Canceling'),
	['Failed']: localize('sql.migration.status.failed', 'Failed'),
	default: undefined
};

export function STATUS_WARNING_COUNT(status: string, count: number): string | undefined {
	if (status === MigrationStatus.InProgress ||
		status === MigrationStatus.Creating ||
		status === MigrationStatus.Completing) {
		switch (count) {
			case 0:
				return undefined;
			case 1:
				return localize('sql.migration.status.warning.count.single', "{0} Warning)", count);
			default:
				return localize('sql.migration.status.warning.count.multiple', "{0} Warnings)", count);
		}
	} else {
		switch (count) {
			case 0:
				return undefined;
			case 1:
				return localize('sql.migration.status.error.count.single', "{0} Error)", count);
			default:
				return localize('sql.migration.status.error.count.multiple', "{0} Errors)", count);
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
export const SQL_MIGRATION_SERVICE_DETAILS_IR_LABEL = localize('sql.migration.service.details.ir.label', "Self-hosted integration runtime node");
export const SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_LABEL = localize('sql.migration.service.details.authKeys.label', "Authentication keys");
export const SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_TITLE = localize('sql.migration.service.details.authKeys.title', "Authentication keys used to connect to the self-hosted integration runtime node");
export const SQL_MIGRATION_SERVICE_DETAILS_STATUS_UNAVAILABLE = localize('sql.migration.service.details.status.unavailable', "-- unavailable --");

//Source Credentials page.
export const SAVE_AND_CLOSE = localize('sql.migration.save.close', "Save and close");
export const SOURCE_CONFIGURATION = localize('sql.migration.source.configuration', "Source configuration");
export const SOURCE_CREDENTIALS = localize('sql.migration.source.credentials', "Source credentials");
export const ENTER_YOUR_SQL_CREDS = localize('sql.migration.enter.your.sql.cred', "Enter the credentials for the source SQL Server instance. These credentials will be used while migrating databases to Azure SQL.");
export const SERVER = localize('sql.migration.server', "Server");
export const USERNAME = localize('sql.migration.username', "Username");
export const SIZE = localize('sql.migration.size', "Size (MB)");
export const LAST_BACKUP = localize('sql.migration.last.backup', "Last backup");
export const DATABASE_FOR_MIGRATION = localize('sql.migration.database.migration', "Databases for migration");
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
export const NO_ISSUES_FOUND_MI = localize('sql.migration.no.issues.mi', "No issues found for migrating to SQL Server on Azure SQL Managed Instance.");
export const NO_RESULTS_AVAILABLE = localize('sql.migration.no.results', 'Assessment results are unavailable.');

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
	return localize('sql.migration.databases.selected', "{0}/{1} Databases selected", selectedCount, totalCount);
}
export function ISSUES_COUNT(totalCount: number): string {
	return localize('sql.migration.issues.count', "Issues ({0})", totalCount);
}
export function WARNINGS_COUNT(totalCount: number): string {
	return localize('sql.migration.warnings.count', "Warnings ({0})", totalCount);
}
export const AUTHENTICATION_TYPE = localize('sql.migration.authentication.type', "Authentication type");

export const REFRESH_BUTTON_LABEL = localize('sql.migration.status.refresh.label', 'Refresh');

// Saved Assessment Dialog
export const NEXT_LABEL = localize('sql.migration.saved.assessment.next', "Next");
export const CANCEL_LABEL = localize('sql.migration.saved.assessment.cancel', "Cancel");
export const SAVED_ASSESSMENT_RESULT = localize('sql.migration.saved.assessment.result', "Saved assessment result");

// Retry Migration
export const MIGRATION_CANNOT_RETRY = localize('sql.migration.cannot.retry', 'Migration cannot be retried.');
export const RETRY_MIGRATION = localize('sql.migration.retry.migration', "Retry migration");
export const MIGRATION_RETRY_ERROR = localize('sql.migration.retry.migration.error', 'An error occurred while retrying the migration.');

export const INVALID_OWNER_URI = localize('sql.migration.invalid.owner.uri.error', 'Cannot connect to the database due to invalid OwnerUri (Parameter \'OwnerUri\')');
export const DATABASE_BACKUP_PAGE_LOAD_ERROR = localize('sql.migration.database.backup.load.error', 'An error occurred while accessing database details.');
