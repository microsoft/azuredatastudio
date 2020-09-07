/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const standardWidth: string = '480px';

// Deploy Azure SQL DB wizard constants
export const WizardTitle = localize('deployAzureSQLDB.NewSQLDBTitle', "Deploy Azure SQL DB");
export const WizardDoneButtonLabel = localize('deployAzureSQLDB.ScriptToNotebook', "Script to Notebook");
export const MissingRequiredInformationErrorMessage = localize('deployCluster.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

// Azure settings page constants
export const AzureSettingsPageTitle = localize('deployAzureSQLDB.AzureSettingsPageTitle', "Azure settings");
export const AzureSettingsPageDescription = localize('deployAzureSQLDB.AzureSettingsPageDescription', "");
export const AzureAccountDropdownLabel = localize('deployAzureSQLDB.AzureAccountDropdownLabel', "Azure Account");
export const AzureAccountSubscriptionDropdownLabel = localize('deployAzureSQLDB.AzureSubscriptionDropdownLabel', "Subscription");
export const AzureAccountDatabaseServersDropdownLabel = localize('deployAzureSQLDB.AzureDatabaseServersDropdownLabel', "Server");
export const AzureAccountResourceGroupDropdownLabel = localize('deployAzureSQLDB.ResourceGroup', "Resource Group");
export const AzureAccountRegionDropdownLabel = localize('deployAzureSQLVM.AzureRegionDropdownLabel', "Region (for Public IP Address)");

// Database settings page constants
export const DatabaseSettingsPageTitle = localize('deployAzureSQLDB.DatabaseSettingsPageTitle', "Database settings");
export const DatabaseSettingsPageDescription = localize('deployAzureSQLDB.DatabaseSettingsPageDescription', "");
export const PublicIPDropdownLabel = localize('deployAzureSQLVM.PublicIPDropdownLabel', "Public IP");
export const NetworkSettingsNewPublicIp = localize('deployAzureSQLVM.NetworkSettingsUseExistingPublicIp', "New public ip");
export const StartIpAddressLabel = localize('deployAzureSQLDB.StartIpAddressLabel', "Start IP Address");
export const EndIpAddressLabel = localize('deployAzureSQLDB.EndIpAddressLabel', "End IP Address");
