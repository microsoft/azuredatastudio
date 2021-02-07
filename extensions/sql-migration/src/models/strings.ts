/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


// #region wizard
export const WIZARD_TITLE = localize('sql-migration.wizard.title', "SQL Migration Wizard");
export const SOURCE_CONFIGURATION_PAGE_TITLE = localize('sql.migration.wizard.source_configuration.title', "SQL Source Configuration");
// //#endregion

export const COLLECTING_SOURCE_CONFIGURATIONS = localize('sql.migration.collecting_source_configurations', "Collecting source configurations");
export const COLLECTING_SOURCE_CONFIGURATIONS_INFO = localize('sql.migration.collecting_source_configurations.info', "We need to collect some information about how your data is configured currently.\nThis may take some time.");
export const COLLECTING_SOURCE_CONFIGURATIONS_ERROR = (error: string = ''): string => {
	return localize('sql.migration.collecting_source_configurations.error', "There was an error when gathering information about your data configuration. {0}", error);
};

export const SKU_RECOMMENDATION_PAGE_TITLE = localize('sql.migration.wizard.sku.title', "Azure SQL Target Selection");
export const SKU_RECOMMENDATION_ALL_SUCCESSFUL = (databaseCount: number): string => {
	return localize('sql.migration.wizard.sku.all', "Based on the results of our source configuration scans, all {0} of your databases can be migrated to Azure SQL.", databaseCount);
};
export const SKU_RECOMMENDATION_SOME_SUCCESSFUL = (migratableCount: number, databaseCount: number): string => {
	return localize('sql.migration.wizard.sku.some', "Based on the results of our source configuration scans, {0} out of {1} of your databases can be migrated to Azure SQL.", migratableCount, databaseCount);
};
export const SKU_RECOMMENDATION_CHOOSE_A_TARGET = localize('sql.migration.wizard.sku.choose_a_target', "Choose a target");

export const SKU_RECOMMENDATION_NONE_SUCCESSFUL = localize('sql.migration.sku.none', "Based on the results of our source configuration scans, none of your databases can be migrated to Azure SQL.");

export const SUBSCRIPTION_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.subscription.title', "Azure Subscription Selection");
export const SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE = localize('sql.migration.wizard.subscription.azure.account.title', "Azure Account");
export const SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE = localize('sql.migration.wizard.subscription.azure.subscription.title', "Azure Subscription");
export const SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE = localize('sql.migration.wizard.subscription.azure.product.title', "Azure Product");

export const CONGRATULATIONS = localize('sql.migration.generic.congratulations', "Congratulations");


// Accounts page
export const ACCOUNTS_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.account.title', "Select your Azure account");
export const ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR = localize('sql.migration.wizard.account.noaccount.error', "There is no linked account. Please add an account.");
export const ACCOUNT_ADD_BUTTON_LABEL = localize('sql.migration.wizard.account.add.button.label', "Add account");
export function accountLinkedMessage(count: number): string {
	return count === 1 ? localize('sql.migration.wizard.account.count.single.message', '{0} account linked', count) : localize('sql.migration.wizard.account.count.multiple.message', '{0} accounts linked', count);
}


// database backup page
export const DATABASE_BACKUP_PAGE_TITLE = localize('sql.migration.database.page.title', "Database Backup");
export const DATABASE_BACKUP_PAGE_DESCRIPTION = localize('sql.migration.database.page.description', "Select the location where we can find your database backups (Full, Differential and Log) to use for migration.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL = localize('sql.migration.nc.network.share.radio.label', "My database backups are on a network share");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT = localize('sql.migration.network.share.help.text', "Enter network share information");
export const DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL = localize('sql.migration.nc.blob.storage.radio.label', "My database backups are in an Azure Storage Blob Container");
export const DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL = localize('sql.migration.nc.file.share.radio.label', "My database backups are in an Azure Storage File Share");
export const DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL = localize('sql.migration.network.share.location.label', "Network share location to read backups from.");
export const DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL = localize('sql.migration.network.share.windows.user.label', "Windows user account with read access to the network share location.");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL = localize('sql.migration.network.share.password.label', "Password");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER = localize('sql.migration.network.share.password.placeholder', "Enter password");
export const DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP = localize('sql.migration.network.share.azure.help', "Enter Azure storage account information where the backup will be copied");
export const DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_LABEL = localize('sql.migration.network.share.subscription.label', "Select the subscription that contains the storage account.");
export const DATABASE_BACKUP_SUBSCRIPTION_PLACEHOLDER = localize('sql.migration.network.share.subscription.placeholder', "Select subscription");
export const DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_LABEL = localize('sql.migration.network.share.storage.account.label', "Select the storage account where backup files will be copied.");
export const DATABASE_BACKUP_STORAGE_ACCOUNT_PLACEHOLDER = localize('sql.migration.network.share.storage.account.placeholder', "Select account");
export const DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL = localize('sql.migration.blob.storage.subscription.label', "Select the subscription that contains the storage account.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL = localize('sql.migration.blob.storage.account.label', "Select the storage account that contains the backup files.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_LABEL = localize('sql.migration.blob.storage.container.label', "Select the container that contains the backup files.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_PLACEHOLDER = localize('sql.migration.blob.storage.container.placeholder', "Select container");
export const DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL = localize('sql.migration.file.share.subscription.label', "Select the subscription that contains the file share.");
export const DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL = localize('sql.migration.file.share.storage.account.label', "Select the storage account that contains the file share.");
export const DATABASE_BACKUP_FILE_SHARE_LABEL = localize('sql.migration.file.share.label', "Select the file share that contains the backup files.");
export const DATABASE_BACKUP_FILE_SHARE_PLACEHOLDER = localize('sql.migration.file.share.placeholder', "Select share");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_LABEL = localize('sql.migration.database.migration.cutover.label', "Migration Cutover");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_DESCRIPTION = localize('sql.migration.database.migration.cutover.description', "Select how you want to cutover when the migration is complete.");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_AUTOMATIC_LABEL = localize('sql.migration.database.migration.cutover.automatic.label', "Automatically cutover when migration is complete");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_MANUAL_LABEL = localize('sql.migration.database.migration.cutover.manual.label', "Manually cutover when migration is complete");
export const DATABASE_BACKUP_EMAIL_NOTIFICATION_LABEL = localize('sql.migration.database.backup.email.notification.label', "Email notifications");
export const DATABASE_BACKUP_EMAIL_NOTIFICATION_CHECKBOX_LABEL = localize('sql.migration.database.backup.email.notification.checkbox.label', "Notify me when migration is complete");
export const NO_SUBSCRIPTIONS_FOUND = localize('sql.migration.no.subscription.found', "No subscription found");
export const NO_STORAGE_ACCOUNT_FOUND = localize('sql.migration.no.storageAccount.found', "No storage account found");
export const NO_FILESHARES_FOUND = localize('sql.migration.no.fileShares.found', "No file shares found");
export const NO_BLOBCONTAINERS_FOUND = localize('sql.migration.no.blobContainers.found', "No blob containers found");
export const INVALID_SUBSCRIPTION_ERROR = localize('sql.migration.invalid.subscription.error', "Please select a valid subscription to proceed.");
export const INVALID_STORAGE_ACCOUNT_ERROR = localize('sql.migration.invalid.storageAccout.error', "Please select a valid storage account to proceed.");
export const INVALID_FILESHARE_ERROR = localize('sql.migration.invalid.fileShare.error', "Please select a valid file share to proceed.");
export const INVALID_BLOBCONTAINER_ERROR = localize('sql.migration.invalid.blobContainer.error', "Please select a valid blob container to proceed.");
export const INVALID_NETWORK_SHARE_LOCATION = localize('sql.migration.invalid.network.share.location', "Invalid network share location format. Example: {0}", '\\\\Servername.domainname.com\\Backupfolder');
export const INVALID_USER_ACCOUNT = localize('sql.migration.invalid.user.account', "Invalid user account format. Example: {0}", 'Domain\\username');


// integration runtime page
export const IR_PAGE_TITLE = localize('sql.migration.ir.page.title', "Migration Controller");
export const IR_PAGE_DESCRIPTION = localize('sql.migration.ir.page.description', "A migration controller is an ARM (Azure Resource Manager) resource created in your Azure subscription and it is needed to coordinate and monitor data migration activities. If one already exists in your subscription, you can reuse it here. Alternatively you can create a new one by clicking New. {0}");
export const SELECT_A_MIGRATION_CONTROLLER = localize('sql.migration.controller', "Select a migration controller");
export const DEFAULT_SETUP_BUTTON = localize('sql.migration.default.setup.button', "Setup with defaults: Add migration controller with one click express setup using default options.");
export const CUSTOM_SETUP_BUTTON = localize('sql.migration.custom.setup.button', "Custom setup: Add migration controller after customizing most options.");
export const MIGRATION_CONTROLLER_NOT_FOUND_ERROR = localize('sql.migration.ir.page.migration.controller.not.found', "No Migration Controllers found. Please create a new one");

// create migration controller dialog
export const CONTROLLER_DIALOG_DESCRIPTION = localize('sql.migration.controller.container.description', "A migration controller is an ARM (Azure Resource Manager) resource created in your Azure subscription and it is needed to coordinate and monitor data migration activities. {0}");
export const CONTROLLER_DIALOG_CONTROLLER_CONTAINER_LOADING_HELP = localize('sql.migration.controller.container.loading.help', "Loading Controller");
export const CONTROLLER_DIALOG_CREATE_CONTROLLER_FORM_HEADING = localize('sql.migration.controller.dialog.create.controller.form.heading', "Enter the information below to add a new migration controller.");
export const CONTROLLER_DIALOG_CONTROLLER_CONTAINER_DESCRIPTION = localize('sql.migration.contoller.container.description', "Migration Controller uses self-hosted Integration Runtime offered by Azure Data Factory for data movement and other migration activities. Follow the instructions below to setup self-hosted Integration Runtime.");
export const CONTROLLER_OPTION1_HEADING = localize('sql.migration.controller.setup.option1.heading', "Option 1: Express setup");
export const CONTROLLER_OPTION1_SETUP_LINK_TEXT = localize('sql.migration.controller.setup.option1.link.text', "Open the express setup for this computer");
export const CONTROLLER_OPTION2_HEADING = localize('sql.migration.controller.setup.option2.heading', "Option 2: Express setup");
export const CONTROLLER_OPTION2_STEP1 = localize('sql.migration.option2.step1', "Step 1: Download and install integration runtime");
export const CONTROLLER_OPTION2_STEP2 = localize('sql.migration.option2.step2', "Step 2: Use this key to register your integration runtime");
export const CONTROLLER_CONNECTION_STATUS = localize('sql.migration.connection.status', "Connection Status");
export const CONTROLELR_KEY1_LABEL = localize('sql.migration.key1.label', "Key 1");
export const CONTROLELR_KEY2_LABEL = localize('sql.migration.key2.label', "Key 2");
export const CONTROLLER_KEY_COPIED_HELP = localize('sql.migration.key.copied', "Key copied");
export const REFRESH_KEYS = localize('sql.migration.refresh.keys', "Refresh keys");
export const COPY_KEY = localize('sql.migration.copy.key', "Copy key");
export const AUTH_KEY_COLUMN_HEADER = localize('sql.migration.authkeys.header', "Authentication key");
export function CONTRLLER_NOT_READY(controllerName: string): string {
	return localize('sql.migration.controller.not.ready', "Migration Controller {0} is not connected to self-hosted Integration Runtime on any node. Click Refresh", controllerName);
}
export function CONTRLLER_READY(controllerName: string, host: string): string {
	return localize('sql.migration.controller.ready', "Migration Controller '{0}' is connected to self-hosted Integration Runtime on the node - '{1}'.`", controllerName, host);
}
export const RESOURCE_GROUP_NOT_FOUND = localize('sql.migration.resource.group.not.found', "No resource Groups found");
export const INVALID_RESOURCE_GROUP_ERROR = localize('sql.migration.invalid.resourceGroup.error', "Please select a valid resource group to proceed.");
export const INVALID_REGION_ERROR = localize('sql.migration.invalid.region.error', "Please select a valid region to proceed.");
export const INVALID_CONTROLLER_NAME_ERROR = localize('sql.migration.invalid.controller.name.error', "Please enter a valid name for the migration controller.");
export const CONTROLLER_NOT_FOUND = localize('sql.migration.controller.not.found', "No Migration Controllers found. Please create a new one.");
export const CONTROLLER_NOT_SETUP_ERROR = localize('sql.migration.controller.not.setup', "Please add a migration controller to proceed.");

export const MANAGED_INSTANCE = localize('sql.migration.managed.instance', "Azure SQL managed instance");
export const NO_MANAGED_INSTANCE_FOUND = localize('sql.migration.no.managedInstance.found', "No managed instance found");
export const TARGET_SELECTION_PAGE_TITLE = localize('sql.migration.target.page.title', "Choose the target Azure SQL");

// common strings
export const LEARN_MORE = localize('sql.migration.learn.more', "Learn more");
export const SUBSCRIPTION = localize('sql.migration.subscription', "Subscription");
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


// Open notebook quick pick string
export const NOTEBOOK_QUICK_PICK_PLACEHOLDER = localize('sql.migration.quick.pick.placeholder', "Type to search for notebook");
export const NOTEBOOK_INLINE_MIGRATION_TITLE = localize('sql.migration.inline.migration.notebook.title', "Inline migration notebook");
export const NOTEBOOK_SQL_MIGRATION_ASSESSMENT_TITLE = localize('sql.migration.sql.assessment.notebook.title', "SQL migration assessment notebook");
