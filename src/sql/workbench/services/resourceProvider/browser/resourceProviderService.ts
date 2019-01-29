/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IResourceProviderService, IHandleFirewallRuleResult } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import * as Constants from 'sql/common/constants';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { FirewallRuleDialogController } from 'sql/parts/accountManagement/firewallRuleDialog/firewallRuleDialogController';

import * as sqlops from 'sqlops';

export class ResourceProviderService implements IResourceProviderService {

	public _serviceBrand: any;
	private _providers: { [handle: string]: sqlops.ResourceProvider; } = Object.create(null);
	private _firewallRuleDialogController: FirewallRuleDialogController;

	constructor(
		@ITelemetryService private _telemetryService: ITelemetryService,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
	}

	/**
	 * Opens the firewall rule dialog
	 */
	public showFirewallRuleDialog(connection: IConnectionProfile, ipAddress: string, resourceProviderId: string): Promise<boolean> {
		let self = this;
		// If the firewall rule dialog hasn't been defined, create a new one
		if (!self._firewallRuleDialogController) {
			self._firewallRuleDialogController = self._instantiationService.createInstance(FirewallRuleDialogController);
		}

		return self._firewallRuleDialogController.openFirewallRuleDialog(connection, ipAddress, resourceProviderId);
	}

	/**
	 * Create a firewall rule
	 */
	public createFirewallRule(selectedAccount: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo, resourceProviderId: string): Promise<sqlops.CreateFirewallRuleResponse> {
		return new Promise<sqlops.CreateFirewallRuleResponse>((resolve, reject) => {
			let provider = this._providers[resourceProviderId];
			if (provider) {
				TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.FirewallRuleRequested, { provider: resourceProviderId });
				provider.createFirewallRule(selectedAccount, firewallruleInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(Constants.InvalidProvider);
			}
		});
	}

	/**
	 * Handle a firewall rule
	 */
	public handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<IHandleFirewallRuleResult> {
		let self = this;
		return new Promise<IHandleFirewallRuleResult>((resolve, reject) => {
			let handleFirewallRuleResult: IHandleFirewallRuleResult;
			let promises = [];
			if (self._providers) {
				for (let key in self._providers) {
					let provider = self._providers[key];
					promises.push(provider.handleFirewallRule(errorCode, errorMessage, connectionTypeId)
						.then(response => {
							if (response.result) {
								handleFirewallRuleResult = { canHandleFirewallRule: response.result, ipAddress: response.ipAddress, resourceProviderId: key };
							}
						},
						() => { /* Swallow failures at getting accounts, we'll just hide that provider */
						}));
				}
			}

			Promise.all(promises).then(() => {
				if (handleFirewallRuleResult) {
					resolve(handleFirewallRuleResult);
				} else {
					handleFirewallRuleResult = { canHandleFirewallRule: false, ipAddress: undefined, resourceProviderId: undefined };
					resolve(handleFirewallRuleResult);
				}
			});
		});
	}

	/**
	 * Register a resource provider
	 */
	public registerProvider(providerId: string, provider: sqlops.ResourceProvider): void {
		this._providers[providerId] = provider;
	}

	public unregisterProvider(providerId: string): void {
		delete this._providers[providerId];
	}
}
