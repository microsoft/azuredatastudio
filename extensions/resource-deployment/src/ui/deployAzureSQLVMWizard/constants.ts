/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// Deploy Azure SQL VM wizard constants
export const WizardTitle = localize('deployAzureSQLVM.NewSQLVMTitle', "Deploy Azure SQL VM");
export const WizardDoneButtonLabel = localize('deployAzureSQLVM.ScriptToNotebook', "Script to Notebook");
export const MissingRequiredInformationErrorMessage = localize('deployCluster.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

// Azure settings page constants
export const AzureSettingsPageTitle = localize('deployAzureSQLVM.AzureSettingsPageTitle', "Azure settings");
export const AzureSettingsPageDescription = localize('deployAzureSQLVM.AzureSettingsPageDescription', "Configure the settings to create an Azure SQL Virtual Machine");
export const AzureAccountDropdownLabel = localize('deployAzureSQLVM.AzureAccountDropdownLabel', "Azure Account");
export const AzureAccountSubscriptionDropdownLabel = localize('deployAzureSQLVM.AzureSubscriptionDropdownLabel', "Azure Subscription");
export const AzureAccountRegionDropdownLabel = localize('deployAzureSQLVM.AzureRegionDropdownLabel', "Azure Region");



