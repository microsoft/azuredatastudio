/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const Account = 'account';

export const AccountsSection = 'accounts';

export const AuthSection = 'auth';

export const AuthenticationLibrarySection = 'authenticationLibrary';

export const AzureSection = 'azure';

export const AzureAccountProviderCredentials = 'azureAccountProviderCredentials';

export const CloudSection = 'cloud';

export const ClearTokenCacheCommand = 'clearTokenCache';

export const ConfigSection = 'config';

export const AccountsClearTokenCacheCommand = AccountsSection + '.' + ClearTokenCacheCommand;

export const AccountsAzureAuthSection = AccountsSection + '.' + AzureSection + '.' + AuthSection;

export const AccountsAzureCloudSection = AccountsSection + '.' + AzureSection + '.' + CloudSection;

export const AzureAuthenticationLibrarySection = AzureSection + '.' + AuthenticationLibrarySection;

export const EnableArcFeaturesSection = 'enableArcFeatures';

export const ServiceName = 'azuredatastudio';

export const TenantSection = 'tenant';

export const AzureTenantConfigSection = AzureSection + '.' + TenantSection + '.' + ConfigSection;

export const NoSystemKeyChainSection = 'noSystemKeychain';

export const oldMsalCacheFileName = 'azureTokenCacheMsal-azure_publicCloud';

/** MSAL Account version */
export const AccountVersion = '2.0';

export const Bearer = 'Bearer';

/** HTTP Client */
export const httpConfigSectionName = 'http';

/**
 * Use SHA-256 algorithm
 */
export const S256_CODE_CHALLENGE_METHOD = 'S256';

export const SELECT_ACCOUNT = 'select_account';

export const Saw = 'saw';

export const ViewType = 'view';

export const HomeCategory = 'Home';

export const dataGridProviderId = 'azure-resources';

export const AzureTokenFolderName = 'Azure Accounts';

export const MSALCacheName = 'accessTokenCache';

export const DefaultAuthLibrary = 'MSAL';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

/**
 * AAD Auth library as selected.
 */
export enum AuthLibrary {
	MSAL = 'MSAL',
	ADAL = 'ADAL'
}

/**
 * Authentication type as selected.
 */
export enum AuthType {
	DeviceCode = 'deviceCode',
	CodeGrant = 'codeGrant'
}

/**
 * Account issuer as received from access token
 */
export enum AccountIssuer {
	Corp = 'corp',
	Msft = 'msft',
}

/**
 * Azure Account type as received from access token
 */
export enum AccountType {
	WorkSchool = 'work_school',
	Microsoft = 'microsoft',
}

export enum Platform {
	Windows = 'win32',
	Mac = 'darwin',
	Linux = 'linux'
}
