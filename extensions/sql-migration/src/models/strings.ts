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
export const ACCOUNTS_SELECTION_PAGE_TITLE = localize('sql.migration.wizard.account.title', "Add your Azure Account to Azure Data Studio");
export const ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR = localize('sql.migration.wizard.account.noaccount.error', "There is no linked account. Please add an account.");
export const ACCOUNT_ADD_BUTTON_LABEL = localize('sql.migration.wizard.account.add.button.label', "Add account");
export function accountLinkedMessage(count: number) {
	return localize('sql.migration.wizard.account.count.message', '{} account linked', count);
}


// database backup page
export const DATABASE_BACKUP_PAGE_TITLE = localize('sql.migration.database.page.title', "Database Backup");
export const DATABASE_BACKUP_PAGE_DESCRIPTION = localize('sql.migration.database.page.description', "Select the location where we can find your database backups (Full, Differential and Log) to use for migration.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL = localize('sql.migration.nc.network.share.radio.label', "My database backups are on a network share.");
export const DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT = localize('sql.migration.network.share.help.text', "Enter network share information.");
export const DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL = localize('sql.migration.nc.blob.storage.radio.label', "My database backups are in Azure Storage Blob Container.");
export const DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL = localize('sql.migration.nc.file.share.radio.label', "My database backups are in Azure Storage File Share.");
export const DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL = localize('sql.migration.network.share.location.label', "Network share location to read backups from.");
export const DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL = localize('sql.migration.network.share.windows.user.label', "Windows user account with read access to the network share location.");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL = localize('sql.migration.network.share.password.label', "Password.");
export const DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER = localize('sql.migration.network.share.password.placeholder', "Enter password");
export const DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP = localize('sql.migration.network.share.azure.help', "Enter Azure storage account information where the backup will be copied");
export const DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_LABEL = localize('sql.migration.network.share.subscription.label', "Select the subscription that contains the storage account.");
export const DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_PLACEHOLDER = localize('sql.migration.network.share.subscription.placeholder', "Select subscription");
export const DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_LABEL = localize('sql.migration.network.share.storage.account.label', "Select the storage account where backup files will be copied");
export const DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_PLACEHOLDER = localize('sql.migration.network.share.storage.account.placeholder', "Select account");
export const DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL = localize('sql.migration.blob.storage.subscription.label', "Select the subscription that contains the storage account.");
export const DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_PLACEHOLDER = localize('sql.migration.blob.storage.subscription.placeholder', "Select subscription");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL = localize('sql.migration.blob.storage.account.label', "Select the storage account that contains the backup files.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_PLACEHOLDER = localize('sql.migration.blob.storage.account.placeholder', "Select account");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_LABEL = localize('sql.migration.blob.storage.container.label', "Select the container that contains the backup files.");
export const DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_PLACEHOLDER = localize('sql.migration.blob.storage.container.placeholder', "Select container");
export const DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL = localize('sql.migration.file.share.subscription.label', "Select the subscription that contains the file share.");
export const DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL = localize('sql.migration.file.share.storage.account.label', "Select the storage account that contains the file share.");
export const DATABASE_BACKUP_FILE_SHARE_LABEL = localize('sql.migration.file.share.label', "Select the file share that contains the backup files.");
export const DATABASE_BACKUP_FILE_SHARE_PLACEHOLDER = localize('sql.migration.file.share.placeholder', "Select share.");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_LABEL = localize('sql.migration.databse.migration.cutover.label', "Migration Cutover");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_DESCRIPTION = localize('sql.migration.databse.migration.cutover.description', "Select how you want to cutover when the migration is complete");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_AUTOMATIC_LABEL = localize('sql.migration.databse.migration.cutover.automatic.label', "Automatically cutover when migration is complete");
export const DATABASE_BACKUP_MIGRATION_CUTOVER_MANUAL_LABEL = localize('sql.migration.databse.migration.cutover.manual.label', "Manually cutover when migration is complete");
export const DATABASE_BACKUP_EMAIL_NOTIFICATION_LABEL = localize('sql.migration.database.backup.email.notification.label', "Email notifications");
export const DATABASE_BACKUP_EMAIL_NOTIFICATION_CHECKBOX_LABEL = localize('sql.migration.database.backup.email.notification.checkbox.label', "Notify me when migration is complete");
export const NO_SUBSCRIPTIONS_FOUND = localize('sql.migration.no.subscription.found', "No subscription found");
export const NO_STORAGE_ACCOUNT_FOUND = localize('sql.migration.no.storageAccount.found', "No storage account found");
export const NO_FILESHARES_FOUND = localize('sql.migration.no.fileShares.found', "No file shares found");
export const NO_BLOBCONTAINERS_FOUND = localize('sql.migration.no.blobContainers.found', "No blob containers found");

