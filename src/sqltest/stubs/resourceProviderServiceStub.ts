/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IHandleFirewallRuleResult, IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export class ResourceProviderStub implements IResourceProviderService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: azdata.ResourceProvider) {

	}

	unregisterProvider(ProviderId: string) {

	}

	createFirewallRule(selectedAccount: azdata.Account, firewallruleInfo: azdata.FirewallRuleInfo, resourceProviderId: string): Promise<azdata.CreateFirewallRuleResponse> {
		return undefined;
	}

	handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Promise<IHandleFirewallRuleResult> {
		return undefined;
	}

	showFirewallRuleDialog(connection: IConnectionProfile, ipAddress: string, resourceProviderId: string): Promise<boolean> {
		return undefined;
	}
}