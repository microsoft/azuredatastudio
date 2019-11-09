/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';

export const SERVICE_ID = 'resourceProviderService';
export const IResourceProviderService = createDecorator<IResourceProviderService>(SERVICE_ID);

export interface IHandleFirewallRuleResult {
	canHandleFirewallRule: boolean;
	ipAddress: string;
	resourceProviderId: string;
}

export interface IResourceProviderService {
	_serviceBrand: undefined;

	/**
	 * Register a resource provider
	 */
	registerProvider(providerId: string, provider: azdata.ResourceProvider): void;

	/**
	 * Unregister a resource provider
	 */
	unregisterProvider(ProviderId: string): void;

	/**
	 * Create a firewall rule
	 */
	createFirewallRule(selectedAccount: azdata.Account, firewallruleInfo: azdata.FirewallRuleInfo, resourceProviderId: string): Promise<azdata.CreateFirewallRuleResponse>;

	/**
	 * handle a firewall rule
	 */
	handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<IHandleFirewallRuleResult>;

	/**
	 * Show firewall rule dialog
	 */
	showFirewallRuleDialog(connection: ConnectionProfile, ipAddress: string, resourceProviderId: string): Promise<boolean>;
}
