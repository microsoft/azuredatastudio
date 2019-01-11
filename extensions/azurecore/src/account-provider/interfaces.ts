'use strict';

import * as sqlops from 'sqlops';

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
	userId: string;
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
}

/**
 * Represents the arguments that identify an instantiation of the AAD account provider
 */
export interface Arguments {
	/**
	 * Host of the authority
	 */
	host: string;

	/**
	 * Identifier of the client application
	 */
	clientId: string;
}

/**
 * Represents settings for an AAD account provider
 */
export interface Settings {
	/**
	 * Host of the authority
	 */
	host?: string;

	/**
	 * Identifier of the client application
	 */
	clientId?: string;

	/**
	 * Identifier of the resource to request when signing in
	 */
	signInResourceId?: string;

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
export interface AzureAccountProviderMetadata extends sqlops.AccountProviderMetadata {
	/**
	 * Azure specific account provider settings.
	 */
	settings: Settings;
}

/**
 * Properties specific to an Azure account
 */
export interface AzureAccountProperties {
	/**
	 * Whether or not the account is a Microsoft account
	 */
	isMsAccount: boolean;

	/**
	 * A list of tenants (aka directories) that the account belongs to
	 */
	tenants: Tenant[];
}

/**
 * Override of the Account type to enforce properties that are AzureAccountProperties
 */
export interface AzureAccount extends sqlops.Account {
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
