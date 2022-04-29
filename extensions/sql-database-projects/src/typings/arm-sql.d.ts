/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** ARM resource. */
export declare interface Resource {
    /**
     * Resource ID.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly id?: string;
    /**
     * Resource name.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly name?: string;
    /**
     * Resource type.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly type?: string;
}

/** Azure Active Directory identity configuration for a resource. */
export declare interface UserIdentity {
    /**
     * The Azure Active Directory principal id.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly principalId?: string;
    /**
     * The Azure Active Directory client id.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly clientId?: string;
}

/**
 * Defines values for IdentityType. \
 * {@link KnownIdentityType} can be used interchangeably with IdentityType,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **None** \
 * **SystemAssigned** \
 * **UserAssigned** \
 * **SystemAssigned,UserAssigned**
 */
 export declare type IdentityType = string;

/** Azure Active Directory identity configuration for a resource. */
export declare interface ResourceIdentity {
    /** The resource ids of the user assigned identities to use */
    userAssignedIdentities?: {
        [propertyName: string]: UserIdentity;
    };
    /**
     * The Azure Active Directory principal id.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly principalId?: string;
    /** The identity type. Set this to 'SystemAssigned' in order to automatically create and assign an Azure Active Directory principal for the resource. */
    type?: IdentityType;
    /**
     * The Azure Active Directory tenant id.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly tenantId?: string;
}

/** ARM tracked top level resource. */
export declare type TrackedResource = Resource & {
    /** Resource location. */
    location: string;
    /** Resource tags. */
    tags?: {
        [propertyName: string]: string;
    };
};

/** An Azure SQL Database server. */
export declare type Server = TrackedResource & {
    /** The Azure Active Directory identity of the server. */
    identity?: ResourceIdentity;
    /**
     * Kind of sql server. This is metadata used for the Azure portal experience.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly kind?: string;
    /** Administrator username for the server. Once created it cannot be changed. */
    administratorLogin?: string;
    /** The administrator login password (required for server creation). */
    administratorLoginPassword?: string;
    /** The version of the server. */
    version?: string;
    /**
     * The state of the server.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly state?: string;
    /**
     * The fully qualified domain name of the server.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly fullyQualifiedDomainName?: string;
    /**
     * List of private endpoint connections on a server
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly privateEndpointConnections?: ServerPrivateEndpointConnection[];
    /** Minimal TLS version. Allowed values: '1.0', '1.1', '1.2' */
    minimalTlsVersion?: string;
    /** Whether or not public endpoint access is allowed for this server.  Value is optional but if passed in, must be 'Enabled' or 'Disabled' */
    publicNetworkAccess?: ServerNetworkAccessFlag;
    /**
     * Whether or not existing server has a workspace created and if it allows connection from workspace
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly workspaceFeature?: ServerWorkspaceFeature;
    /** The resource id of a user assigned identity to be used by default. */
    primaryUserAssignedIdentityId?: string;
    /** The Client id used for cross tenant CMK scenario */
    federatedClientId?: string;
    /** A CMK URI of the key to use for encryption. */
    keyId?: string;
    /** The Azure Active Directory identity of the server. */
    administrators?: ServerExternalAdministrator;
    /** Whether or not to restrict outbound network access for this server.  Value is optional but if passed in, must be 'Enabled' or 'Disabled' */
    restrictOutboundNetworkAccess?: ServerNetworkAccessFlag;
};

/** A private endpoint connection under a server */
export declare interface ServerPrivateEndpointConnection {
    /**
     * Resource ID.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly id?: string;
    /**
     * Private endpoint connection properties
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly properties?: PrivateEndpointConnectionProperties;
}

/**
 * Defines values for ServerNetworkAccessFlag. \
 * {@link KnownServerNetworkAccessFlag} can be used interchangeably with ServerNetworkAccessFlag,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **Enabled** \
 * **Disabled**
 */
 export declare type ServerNetworkAccessFlag = string;

 /**
 * Defines values for ServerWorkspaceFeature. \
 * {@link KnownServerWorkspaceFeature} can be used interchangeably with ServerWorkspaceFeature,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **Connected** \
 * **Disconnected**
 */
export declare type ServerWorkspaceFeature = string;

/** Properties of a active directory administrator. */
export declare interface ServerExternalAdministrator {
    /** Type of the sever administrator. */
    administratorType?: AdministratorType;
    /** Principal Type of the sever administrator. */
    principalType?: PrincipalType;
    /** Login name of the server administrator. */
    login?: string;
    /** SID (object ID) of the server administrator. */
    sid?: string;
    /** Tenant ID of the administrator. */
    tenantId?: string;
    /** Azure Active Directory only Authentication enabled. */
    azureADOnlyAuthentication?: boolean;
}


/** Properties of a private endpoint connection. */
export declare interface PrivateEndpointConnectionProperties {
    /** Private endpoint which the connection belongs to. */
    privateEndpoint?: PrivateEndpointProperty;
    /** Connection state of the private endpoint connection. */
    privateLinkServiceConnectionState?: PrivateLinkServiceConnectionStateProperty;
    /**
     * State of the private endpoint connection.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly provisioningState?: PrivateEndpointProvisioningState;
}

/**
 * Defines values for AdministratorType. \
 * {@link KnownAdministratorType} can be used interchangeably with AdministratorType,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **ActiveDirectory**
 */
 export declare type AdministratorType = string;

 /**
 * Defines values for PrincipalType. \
 * {@link KnownPrincipalType} can be used interchangeably with PrincipalType,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **User** \
 * **Group** \
 * **Application**
 */
export declare type PrincipalType = string;

export declare interface PrivateEndpointProperty {
    /** Resource id of the private endpoint. */
    id?: string;
}

export declare interface PrivateLinkServiceConnectionStateProperty {
    /** The private link service connection status. */
    status: PrivateLinkServiceConnectionStateStatus;
    /** The private link service connection description. */
    description: string;
    /**
     * The actions required for private link service connection.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly actionsRequired?: PrivateLinkServiceConnectionStateActionsRequire;
}

/**
 * Defines values for PrivateEndpointProvisioningState. \
 * {@link KnownPrivateEndpointProvisioningState} can be used interchangeably with PrivateEndpointProvisioningState,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **Approving** \
 * **Ready** \
 * **Dropping** \
 * **Failed** \
 * **Rejecting**
 */
 export declare type PrivateEndpointProvisioningState = string;

 /**
 * Defines values for PrivateLinkServiceConnectionStateStatus. \
 * {@link KnownPrivateLinkServiceConnectionStateStatus} can be used interchangeably with PrivateLinkServiceConnectionStateStatus,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **Approved** \
 * **Pending** \
 * **Rejected** \
 * **Disconnected**
 */
export declare type PrivateLinkServiceConnectionStateStatus = string;

/**
 * Defines values for PrivateLinkServiceConnectionStateActionsRequire. \
 * {@link KnownPrivateLinkServiceConnectionStateActionsRequire} can be used interchangeably with PrivateLinkServiceConnectionStateActionsRequire,
 *  this enum contains the known values that the service supports.
 * ### Known values supported by the service
 * **None**
 */
 export declare type PrivateLinkServiceConnectionStateActionsRequire = string;

 export declare interface PrivateLinkServiceConnectionStateProperty {
	 /** The private link service connection status. */
	 status: PrivateLinkServiceConnectionStateStatus;
	 /** The private link service connection description. */
	 description: string;
	 /**
	  * The actions required for private link service connection.
	  * NOTE: This property will not be serialized. It can only be populated by the server.
	  */
	 readonly actionsRequired?: PrivateLinkServiceConnectionStateActionsRequire;
 }

