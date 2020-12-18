/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * Represents a tenant (an Azure Active Directory instance) to which a user has access
 */
export interface Tenant {
	/**
	 * Globally unique identifier of the tenant
	 */
	id: string;

	/**
	 * Display name of the tenant
	 */
	displayName: string;

	/**
	 * Identifier of the user in the tenant
	 */
	userId?: string;

	/**
	 * The category the user has set their tenant to (e.g. Home Tenant)
	 */
	tenantCategory?: string;
}

/**
 * Represents a resource exposed by an Azure Active Directory
 */
export interface Resource {
	/**
	 * Identifier of the resource
	 */
	id: string;

	/**
	 * Endpoint url used to access the resource
	 */
	endpoint: string;

	/**
	 * Resource ID for azdata
	 */
	azureResourceId?: azdata.AzureResource
}

/**
 * Represents settings for an AAD account provider
 */
interface Settings {
	/**
	 * Host of the authority
	 */
	host?: string;

	/**
	 * Identifier of the client application
	 */
	clientId?: string;

	/**
	 * Information that describes the Microsoft resource management resource
	 */
	microsoftResource?: Resource

	/**
	 * Information that describes the AAD graph resource
	 */
	graphResource?: Resource;

	/**
	 * Information that describes the Azure resource management resource
	 */
	armResource?: Resource;

	/**
	 * Information that describes the SQL Azure resource
	 */
	sqlResource?: Resource;

	/**
	 * Information that describes the OSS RDBMS resource
	 */
	ossRdbmsResource?: Resource;

	/**
	 * Information that describes the Azure Key Vault resource
	 */
	azureKeyVaultResource?: Resource;

	/**
	 * Information that describes the Azure Dev Ops resource
	 */
	azureDevOpsResource?: Resource;

	/**
	 * A list of tenant IDs to authenticate against. If defined, then these IDs will be used
	 * instead of querying the tenants endpoint of the armResource
	 */
	adTenants?: string[];

	// AuthorizationCodeGrantFlowSettings //////////////////////////////////

	/**
	 * An optional site ID that brands the interactive aspect of sign in
	 */
	siteId?: string;

	/**
	 * Redirect URI that is used to signify the end of the interactive aspect of sign it
	 */
	redirectUri?: string;

	scopes?: string[]

	portalEndpoint?: string
}

/**
 * Mapping of configuration key with the metadata to instantiate the account provider
 */
export interface ProviderSettings {
	/**
	 * Key for configuration regarding whether the account provider is enabled
	 */
	configKey: string;

	/**
	 * Metadata for the provider
	 */
	metadata: AzureAccountProviderMetadata;
}

/**
 * Extension of account provider metadata to override settings type for Azure account providers
 */
export interface AzureAccountProviderMetadata extends azdata.AccountProviderMetadata {
	/**
	 * Azure specific account provider settings.
	 */
	settings: Settings;
}

export enum AzureAuthType {
	AuthCodeGrant = 0,
	DeviceCode = 1
}

/**
 * Properties specific to an Azure account
 */
interface AzureAccountProperties {
	/**
	 * Auth type of azure used to authenticate this account.
	 */
	azureAuthType?: AzureAuthType

	providerSettings: AzureAccountProviderMetadata;
	/**
	 * Whether or not the account is a Microsoft account
	 */
	isMsAccount: boolean;

	/**
	 * A list of tenants (aka directories) that the account belongs to
	 */
	tenants: Tenant[];

}

export interface Subscription {
	id: string,
	tenantId: string,
	displayName: string
}

/**
 * Override of the Account type to enforce properties that are AzureAccountProperties
 */
export interface AzureAccount extends azdata.Account {
	/**
	 * AzureAccountProperties specifically used for Azure accounts
	 */
	properties: AzureAccountProperties;
}

/**
 * Token returned from a request for an access token
 */
export interface AzureAccountSecurityToken {
	/**
	 * Access token, itself
	 */
	token: string;

	/**
	 * Date that the token expires on
	 */
	expiresOn: Date | string;

	/**
	 * Name of the resource the token is good for (ie, management.core.windows.net)
	 */
	resource: string;

	/**
	 * Type of the token (pretty much always 'Bearer')
	 */
	tokenType: string;
}

/**
 * Azure account security token maps a tenant ID to the information returned from a request to get
 * an access token. The list of tenants correspond to the tenants in the account properties.
 */
export type AzureAccountSecurityTokenCollection = { [tenantId: string]: AzureAccountSecurityToken };

export interface Deferred<T, E extends Error = Error> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: E) => void;
}
