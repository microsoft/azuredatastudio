/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IResourceProviderService, IHandleFirewallRuleResult } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as TelemetryUtils from 'sql/platform/telemetry/common/telemetryUtilities';
import { FirewallRuleDialogController } from 'sql/platform/accounts/browser/firewallRuleDialogController';

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';

export class ResourceProviderService implements IResourceProviderService {

	public _serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.ResourceProvider; } = Object.create(null);
	private _firewallRuleDialogController: FirewallRuleDialogController;

	constructor(
		@ITelemetryService private _telemetryService: ITelemetryService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
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
	public createFirewallRule(selectedAccount: azdata.Account, firewallruleInfo: azdata.FirewallRuleInfo, resourceProviderId: string): Promise<azdata.CreateFirewallRuleResponse> {
		return new Promise<azdata.CreateFirewallRuleResponse>((resolve, reject) => {
			const provider = this._providers[resourceProviderId];
			if (provider) {
				TelemetryUtils.addTelemetry(this._telemetryService, this.logService, TelemetryKeys.FirewallRuleRequested, { provider: resourceProviderId });
				provider.createFirewallRule(selectedAccount, firewallruleInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
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
	public registerProvider(providerId: string, provider: azdata.ResourceProvider): void {
		this._providers[providerId] = provider;
	}

	public unregisterProvider(providerId: string): void {
		delete this._providers[providerId];
	}
}
