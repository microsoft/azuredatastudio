/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { localize } from 'vs/nls';
import * as sqlops from 'sqlops';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { FirewallRuleDialog } from 'sql/parts/accountManagement/firewallRuleDialog/firewallRuleDialog';
import { IAccountManagementService, AzureResource } from 'sql/platform/accountManagement/common/interfaces';
import { IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { Deferred } from 'sql/base/common/promise';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class FirewallRuleDialogController {

	private _firewallRuleDialog: FirewallRuleDialog;
	private _connection: IConnectionProfile;
	private _resourceProviderId: string;

	private _addAccountErrorTitle = localize('firewallDialog.addAccountErrorTitle', 'Error adding account');
	private _firewallRuleErrorTitle = localize('firewallRuleError', 'Firewall rule error');
	private _deferredPromise: Deferred<boolean>;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IResourceProviderService private _resourceProviderService: IResourceProviderService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
	}

	/**
	 * Open firewall rule dialog
	 */
	public openFirewallRuleDialog(connection: IConnectionProfile, ipAddress: string, resourceProviderId: string): Promise<boolean> {
		if (!this._firewallRuleDialog) {
			this._firewallRuleDialog = this._instantiationService.createInstance(FirewallRuleDialog);
			this._firewallRuleDialog.onCancel(this.handleOnCancel, this);
			this._firewallRuleDialog.onCreateFirewallRule(this.handleOnCreateFirewallRule, this);
			this._firewallRuleDialog.onAddAccountErrorEvent(this.handleOnAddAccountError, this);
			this._firewallRuleDialog.render();
		}
		this._connection = connection;
		this._resourceProviderId = resourceProviderId;
		this._firewallRuleDialog.viewModel.updateDefaultValues(ipAddress);
		this._firewallRuleDialog.open();
		this._deferredPromise = new Deferred();
		return this._deferredPromise.promise;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private handleOnAddAccountError(message: string): void {
		this._errorMessageService.showDialog(Severity.Error, this._addAccountErrorTitle, message);
	}

	private handleOnCreateFirewallRule(): void {
		let resourceProviderId = this._resourceProviderId;

		this._accountManagementService.getSecurityToken(this._firewallRuleDialog.viewModel.selectedAccount, AzureResource.ResourceManagement).then(tokenMappings => {
			let firewallRuleInfo: sqlops.FirewallRuleInfo = {
				startIpAddress: this._firewallRuleDialog.viewModel.isIPAddressSelected ? this._firewallRuleDialog.viewModel.defaultIPAddress : this._firewallRuleDialog.viewModel.fromSubnetIPRange,
				endIpAddress: this._firewallRuleDialog.viewModel.isIPAddressSelected ? this._firewallRuleDialog.viewModel.defaultIPAddress : this._firewallRuleDialog.viewModel.toSubnetIPRange,
				serverName: this._connection.serverName,
				securityTokenMappings: tokenMappings
			};

			this._resourceProviderService.createFirewallRule(this._firewallRuleDialog.viewModel.selectedAccount, firewallRuleInfo, resourceProviderId).then(createFirewallRuleResponse => {
				if (createFirewallRuleResponse.result) {
					this._firewallRuleDialog.close();
					this._deferredPromise.resolve(true);
				} else {
					this._errorMessageService.showDialog(Severity.Error, this._firewallRuleErrorTitle, createFirewallRuleResponse.errorMessage);
				}
				this._firewallRuleDialog.onServiceComplete();
			}, error => {
				this.showError(error);
			});
		}, error => {
			this.showError(error);
		});
	}

	private showError(error: any): void {
		this._errorMessageService.showDialog(Severity.Error, this._firewallRuleErrorTitle, error);
		this._firewallRuleDialog.onServiceComplete();
		// Note: intentionally not rejecting the promise as we want users to be able to choose a different account
	}

	private handleOnCancel(): void {
		this._deferredPromise.resolve(false);
	}

}
