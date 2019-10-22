/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IHandleFirewallRuleResult, IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export class TestResourceProvider implements IResourceProviderService {
	_serviceBrand: undefined;

	registerProvider(providerId: string, provider: azdata.ResourceProvider): void {

	}

	unregisterProvider(ProviderId: string): void {

	}

	createFirewallRule(selectedAccount: azdata.Account, firewallruleInfo: azdata.FirewallRuleInfo, resourceProviderId: string): Promise<azdata.CreateFirewallRuleResponse> {
		throw new Error('Method not implemented');
	}

	handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<IHandleFirewallRuleResult> {
		throw new Error('Method not implemented');
	}

	showFirewallRuleDialog(connection: IConnectionProfile, ipAddress: string, resourceProviderId: string): Promise<boolean> {
		return Promise.resolve(true);
	}
}
