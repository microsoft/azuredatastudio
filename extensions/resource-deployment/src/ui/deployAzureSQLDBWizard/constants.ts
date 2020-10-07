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
export const MissingRequiredInformationErrorMessage = localize('deployAzureSQLDB.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

// Azure settings page constants
export const AzureSettingsPageTitle = localize('deployAzureSQLDB.AzureSettingsPageTitle', "Azure SQL Database - Azure Account Settings");
export const AzureSettingsSummaryPageTitle = localize('deployAzureSQLDB.AzureSettingsSummaryPageTitle', "Azure Account Settings");
export const AzureAccountDropdownLabel = localize('deployAzureSQLDB.AzureAccountDropdownLabel', "Azure Account");
export const AzureAccountSubscriptionDropdownLabel = localize('deployAzureSQLDB.AzureSubscriptionDropdownLabel', "Subscription");
export const AzureAccountDatabaseServersDropdownLabel = localize('deployAzureSQLDB.AzureDatabaseServersDropdownLabel', "Server");
export const AzureAccountResourceGroupDropdownLabel = localize('deployAzureSQLDB.ResourceGroup', "Resource Group");
//@todo alma1 9/8/20 Region label used for upcoming server creation feature.
//export const AzureAccountRegionDropdownLabel = localize('deployAzureSQLDB.AzureRegionDropdownLabel', "Region (for Public IP Address)");

//Azure settings Database hardware properties. //@todo alma1 9/8/20 labels used for upcoming database hardware creation feature.
// export const DatabaseHardwareInfoLabel = localize('deployAzureSQLDB.DatabaseHardwareInfo', "SQLDB Hardware Settings");
// export const DatabaseManagedInstanceDropdownLabel = localize('deployAzureSQLDB.DatabaseManagedInstanceDropdownLabel', "SQLDB Version");
// export const DatabaseSupportedEditionsDropdownLabel = localize('deployAzureSQLDB.DatabaseSupportedEditionsDropdownLabel', "Edition Type");
// export const DatabaseSupportedFamilyDropdownLabel = localize('deployAzureSQLDB.DatabaseSupportedFamilyDropdownLabel', "Family Type");
// export const DatabaseVCoreNumberDropdownLabel = localize('deployAzureSQLDB.DatabaseVCoreNumberDropdownLabel', "Number of Vcores");
// export const DatabaseMaxMemoryTextLabel = localize('deployAzureSQLDB.DatabaseMaxMemoryTextLabel', "Maximum Data Storage Capacity in GB, can go up to 1TB (1024 GB).");
// export const DatabaseMaxMemorySummaryTextLabel = localize('deployAzureSQLDB.DatabaseMaxMemorySummaryTextLabel', "Maximum Data Storage Capacity in GB");

// Database settings page constants
export const DatabaseSettingsPageTitle = localize('deployAzureSQLDB.DatabaseSettingsPageTitle', "Database settings");
export const FirewallRuleNameLabel = localize('deployAzureSQLDB.FirewallRuleNameLabel', "Firewall rule name");
export const DatabaseNameLabel = localize('deployAzureSQLDB.DatabaseNameLabel', "SQL database name");
export const CollationNameLabel = localize('deployAzureSQLDB.CollationNameLabel', "Database collation");
export const CollationNameSummaryLabel = localize('deployAzureSQLDB.CollationNameSummaryLabel', "Collation for database");
export const IpAddressInfoLabel = localize('deployAzureSQLDB.IpAddressInfoLabel', "Enter IP Addresses in IVP4 format.");
export const StartIpAddressLabel = localize('deployAzureSQLDB.StartIpAddressLabel', "Min IP Address in firewall Ip Range");
export const EndIpAddressLabel = localize('deployAzureSQLDB.EndIpAddressLabel', "Max IP Address in firewall IP Range");
export const StartIpAddressShortLabel = localize('deployAzureSQLDB.StartIpAddressShortLabel', "Min IP Address");
export const EndIpAddressShortLabel = localize('deployAzureSQLDB.EndIpAddressShortLabel', "Max IP Address");
