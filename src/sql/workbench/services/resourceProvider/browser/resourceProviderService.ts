/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IResourceProviderService, IHandleFirewallRuleResult } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { FirewallRuleDialogController } from 'sql/workbench/services/resourceProvider/browser/firewallRuleDialogController';

import * as azdata from 'azdata';
import { invalidProvider } from 'sql/base/common/errors';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

export class ResourceProviderService implements IResourceProviderService {

	public _serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.ResourceProvider; } = Object.create(null);
	private _firewallRuleDialogController: FirewallRuleDialogController;

	constructor(
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
		@IInstantiationService private _instantiationService: IInstantiationService
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
				this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.FirewallRuleRequested)
					.withAdditionalProperties({
						provider: resourceProviderId
					}).send();
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
	public async handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<IHandleFirewallRuleResult> {
		let handleFirewallRuleResult: IHandleFirewallRuleResult = { canHandleFirewallRule: false, ipAddress: undefined, resourceProviderId: undefined };
		const promises = [];
		if (this._providers) {
			for (const key in this._providers) {
				const provider = this._providers[key];
				promises.push(provider.handleFirewallRule(errorCode, errorMessage, connectionTypeId)
					.then(response => {
						if (response.result) {
							handleFirewallRuleResult = { canHandleFirewallRule: response.result, ipAddress: response.ipAddress, resourceProviderId: key };
						}
					}, () => { /* Swallow failures at getting accounts, we'll just hide that provider */
					}));
			}
		}

		await Promise.all(promises);
		return handleFirewallRuleResult;
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
