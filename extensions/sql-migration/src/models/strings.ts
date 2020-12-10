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
