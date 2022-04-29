/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export declare interface ResourceGroup {
    /**
     * The ID of the resource group.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly id?: string;
    /**
     * The name of the resource group.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly name?: string;
    /**
     * The type of the resource group.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly type?: string;
    /** The resource group properties. */
    properties?: ResourceGroupProperties;
    /** The location of the resource group. It cannot be changed after the resource group has been created. It must be one of the supported Azure locations. */
    location: string;
    /** The ID of the resource that manages this resource group. */
    managedBy?: string;
    /** The tags attached to the resource group. */
    tags?: {
        [propertyName: string]: string;
    };
}

/** The resource group properties. */
export declare interface ResourceGroupProperties {
    /**
     * The provisioning state.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly provisioningState?: string;
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export declare interface ResourceGroup {
    /**
     * The ID of the resource group.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly id?: string;
    /**
     * The name of the resource group.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly name?: string;
    /**
     * The type of the resource group.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly type?: string;
    /** The resource group properties. */
    properties?: ResourceGroupProperties;
    /** The location of the resource group. It cannot be changed after the resource group has been created. It must be one of the supported Azure locations. */
    location: string;
    /** The ID of the resource that manages this resource group. */
    managedBy?: string;
    /** The tags attached to the resource group. */
    tags?: {
        [propertyName: string]: string;
    };
}

/** The resource group properties. */
export declare interface ResourceGroupProperties {
    /**
     * The provisioning state.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly provisioningState?: string;
}
