/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';
import * as sqlops from 'sqlops';

import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

export const SERVICE_ID = 'resourceProviderService';
export const IResourceProviderService = createDecorator<IResourceProviderService>(SERVICE_ID);

export interface IHandleFirewallRuleResult {
	canHandleFirewallRule: boolean;
	ipAddress: string;
	resourceProviderId: string;
}

export interface IResourceProviderService {
	_serviceBrand: any;

	/**
	 * Register a resource provider
	 */
	registerProvider(providerId: string, provider: sqlops.ResourceProvider): void;

	/**
	 * Unregister a resource provider
	 */
	unregisterProvider(ProviderId: string): void;

	/**
	 * Create a firewall rule
	 */
	createFirewallRule(selectedAccount: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo, resourceProviderId: string): Promise<sqlops.CreateFirewallRuleResponse>;

	/**
	 * handle a firewall rule
	 */
	handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<IHandleFirewallRuleResult>;

	/**
	 * Show firewall rule dialog
	 */
	showFirewallRuleDialog(connection: IConnectionProfile, ipAddress: string, resourceProviderId: string): Promise<boolean>;
}

export const IAccountPickerService = createDecorator<IAccountPickerService>('AccountPickerService');
export interface IAccountPickerService {
	_serviceBrand: any;
	renderAccountPicker(container: HTMLElement): void;
	addAccountCompleteEvent: Event<void>;
	addAccountErrorEvent: Event<string>;
	addAccountStartEvent: Event<void>;
	onAccountSelectionChangeEvent: Event<sqlops.Account>;
	selectedAccount: sqlops.Account;
}
