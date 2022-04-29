/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Location information. */
declare interface Location_2 {
    /**
     * The fully qualified ID of the location. For example, /subscriptions/00000000-0000-0000-0000-000000000000/locations/westus.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly id?: string;
    /**
     * The subscription ID.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly subscriptionId?: string;
    /**
     * The location name.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly name?: string;
    /**
     * The display name of the location.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly displayName?: string;
    /**
     * The latitude of the location.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly latitude?: string;
    /**
     * The longitude of the location.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly longitude?: string;
}
export { Location_2 as Location };

/** Subscription information. */
export declare interface Subscription {
    /**
     * The fully qualified ID for the subscription. For example, /subscriptions/00000000-0000-0000-0000-000000000000.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly id?: string;
    /**
     * The subscription ID.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly subscriptionId?: string;
    /**
     * The subscription display name.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly displayName?: string;
    /**
     * The subscription state. Possible values are Enabled, Warned, PastDue, Disabled, and Deleted.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly state?: SubscriptionState;
    /** The subscription policies. */
    subscriptionPolicies?: SubscriptionPolicies;
    /** The authorization source of the request. Valid values are one or more combinations of Legacy, RoleBased, Bypassed, Direct and Management. For example, 'Legacy, RoleBased'. */
    authorizationSource?: string;
}

/** Defines values for SubscriptionState. */
export declare type SubscriptionState = "Enabled" | "Warned" | "PastDue" | "Disabled" | "Deleted";


/** Subscription policies. */
export declare interface SubscriptionPolicies {
    /**
     * The subscription location placement ID. The ID indicates which regions are visible for a subscription. For example, a subscription with a location placement Id of Public_2014-09-01 has access to Azure public regions.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly locationPlacementId?: string;
    /**
     * The subscription quota ID.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly quotaId?: string;
    /**
     * The subscription spending limit.
     * NOTE: This property will not be serialized. It can only be populated by the server.
     */
    readonly spendingLimit?: SpendingLimit;
}

/** Defines values for SpendingLimit. */
export declare type SpendingLimit = "On" | "Off" | "CurrentPeriodOff";
