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

export const Filter = 'filter';

export const NoSystemKeyChainSection = 'noSystemKeychain';

export const oldMsalCacheFileName = 'azureTokenCacheMsal-azure_publicCloud';

export const piiLogging = 'piiLogging';

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

export const LocalCacheSuffix = '.local';

export const LockFileSuffix = '.lockfile';

/////// MSAL ERROR CODES, ref: https://learn.microsoft.com/en-us/azure/active-directory/develop/reference-aadsts-error-codes
/**
 * The refresh token has expired or is invalid due to sign-in frequency checks by conditional access.
 * The token was issued on {issueDate} and the maximum allowed lifetime for this request is {time}.
 */
export const AADSTS70043 = 'AADSTS70043';
/**
 * FreshTokenNeeded - The provided grant has expired due to it being revoked, and a fresh auth token is needed.
 * Either an admin or a user revoked the tokens for this user, causing subsequent token refreshes to fail and
 * require reauthentication. Have the user sign in again.
 */
export const AADSTS50173 = 'AADSTS50173';

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
