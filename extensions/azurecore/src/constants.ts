/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const Account = 'account';

export const AccountsSection = 'accounts';

export const AuthSection = 'auth';

export const AzureSection = 'azure';

export const AzureAccountProviderCredentials = 'azureAccountProviderCredentials';

export const CloudSection = 'cloud';

export const ClearTokenCacheCommand = 'clearTokenCache';

export const ConfigSection = 'config';

export const AccountsClearTokenCacheCommand = AccountsSection + '.' + ClearTokenCacheCommand;

export const AccountsAzureAuthSection = AccountsSection + '.' + AzureSection + '.' + AuthSection;

export const AccountsAzureCloudSection = AccountsSection + '.' + AzureSection + '.' + CloudSection;

export const enablePublicCloud = 'enablePublicCloud';

export const enableUsGovCloud = 'enableUsGovCloud';

export const enableChinaCloud = 'enableChinaCloud';

export const EnableArcFeaturesSection = 'enableArcFeatures';

export const ServiceName = 'azuredatastudio';

export const TenantSection = 'tenant';

export const AzureTenantConfigSection = AzureSection + '.' + TenantSection + '.' + ConfigSection;

export const Filter = 'filter';

export const AzureTenantConfigFilterSetting = AzureTenantConfigSection + '.' + Filter;

export const NoSystemKeyChainSection = 'noSystemKeychain';

export const oldMsalCacheFileName = 'azureTokenCacheMsal-azure_publicCloud';

export const piiLogging = 'piiLogging';

export const CustomProviderSettings = 'customProviderSettings';

export const CustomProviderSettingsSection = AzureSection + '.' + CustomProviderSettings;

export const PackageName = 'Microsoft.azurecore';

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
/**
 * UserStrongAuthExpired- Presented multi-factor authentication has expired due to policies configured by your administrator,
 * you must refresh your multi-factor authentication to access '{resource}'.
 */
export const AADSTS50078 = 'AADSTS50078';
/**
 * Refresh token needs social IDP login. Have user try signing-in again with username -password
 */
export const AADSTS50085 = 'AADSTS50085';
/**
 * Authentication failed due to flow token expired. Expected - auth codes, refresh tokens, and sessions expire over time
 * or are revoked by the user or an admin. The app will request a new login from the user.
 */
export const AADSTS50089 = 'AADSTS50089';
/**
 * ExpiredOrRevokedGrantInactiveToken - The refresh token has expired due to inactivity.
 * The token was issued on {issueDate} and was inactive for {time}. Expected part of the token lifecycle -
 * the user went an extended period of time without using the application, so the token was expired when the app attempted to refresh it.
 */
export const AADSTS700082 = 'AADSTS700082';
/**
 * The refresh token was issued to a single page app (SPA), and therefore has a fixed, limited lifetime of {time}, which can't be extended.
 * It is now expired and a new sign in request must be sent by the SPA to the sign in page. The token was issued on {issueDate}.
 */
export const AADSTS700084 = 'AADSTS700084';

/**
 * multiple_matching_tokens error can occur in scenarios when users try to run ADS as different users, reference issue:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/5134
 * Error message: multiple_matching_tokens The cache contains multiple tokens satisfying the requirements.
 * Call AcquireToken again providing more requirements such as authority or account.
 */
export const multiple_matching_tokens_error = 'multiple_matching_tokens';

export enum BuiltInCommands {
	SetContext = 'setContext'
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

/////////////// Azure Resource provider Ids
export const AZURE_MONITOR_PROVIDER_ID = 'azure.resource.providers.azureMonitor';
export const COSMOSDB_MONGO_PROVIDER_ID = 'azure.resource.providers.cosmosDbMongo';
export const COSMOSDB_NOSQL_PROVIDER_ID = 'azure.resource.providers.cosmosDbNoSql';
export const COSMOSDB_POSTGRES_PROVIDER_ID = 'azure.resource.providers.cosmosDbPostgres';
export const DATABASE_PROVIDER_ID = 'azure.resource.providers.database';
export const DATABASE_SERVER_PROVIDER_ID = 'azure.resource.providers.databaseServer';
export const KUSTO_PROVIDER_ID = 'azure.resource.providers.azureDataExplorer';
export const MYSQL_FLEXIBLE_SERVER_PROVIDER_ID = 'azure.resource.providers.mysqlFlexibleServer';
export const POSTGRES_ARC_SERVER_PROVIDER_ID = 'azure.resource.providers.postgresArcServer';
export const POSTGRES_FLEXIBLE_SERVER_PROVIDER_ID = 'azure.resource.providers.postgresFlexibleServer';
export const POSTGRES_SERVER_PROVIDER_ID = 'azure.resource.providers.postgresServer';
export const SQLINSTANCE_PROVIDER_ID = 'azure.resource.providers.sqlInstance';
export const SQLINSTANCE_ARC_PROVIDER_ID = 'azure.resource.providers.sqlInstanceArc';
export const SYNAPSE_SQL_POOL_PROVIDER_ID = 'azure.resource.providers.synapseSqlPool';
export const SYNAPSE_WORKSPACE_PROVIDER_ID = 'azure.resource.providers.synapseWorkspace';
export const UNIVERSAL_PROVIDER_ID = 'azure.resource.providers.universal';
