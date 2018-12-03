/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import ControllerBase from './controllerBase';
import { DidChangeAccountsParams } from 'sqlops';

import { AzureResourceTreeProvider } from '../azureResource/tree/treeProvider';
import { registerAzureResourceCommands } from '../azureResource/commands';
import { AzureResourceServicePool } from '../azureResource/servicePool';
import { AzureResourceAccountService } from '../azureResource/services/accountService';
import { AzureResourceSubscriptionService } from '../azureResource/services/subscriptionService';
import { AzureResourceSubscriptionFilterService } from '../azureResource/services/subscriptionFilterService';
import { AzureResourceCacheService } from '../azureResource/services/cacheService';
import { AzureResourceTenantService } from '../azureResource/services/tenantService';
import { AzureResourceLogService } from '../azureResource/services/logService';

import { registerAzureResourceDatabaseServerCommands } from '../azureResource/providers/databaseServer/commands';
import { registerAzureResourceDatabaseCommands } from '../azureResource/providers/database/commands';

export default class AzureResourceController extends ControllerBase {
	public activate(): Promise<boolean> {
		const debugOutputChannel = this.apiWrapper.createOutputChannel('Azure Resource Debug');
		debugOutputChannel.show(false);

		let servicePool = AzureResourceServicePool.getInstance();

		servicePool.logSerivce = new AzureResourceLogService(debugOutputChannel);
		servicePool.extensionContext = this.extensionContext;
		servicePool.apiWrapper = this.apiWrapper;
		servicePool.cacheService = new AzureResourceCacheService(this.extensionContext);
		servicePool.accountService = new AzureResourceAccountService(this.apiWrapper);
		servicePool.subscriptionService = new AzureResourceSubscriptionService();
		servicePool.subscriptionFilterService = new AzureResourceSubscriptionFilterService(new AzureResourceCacheService(this.extensionContext));
		servicePool.tenantServicxe = new AzureResourceTenantService();

		const azureResourceTree = new AzureResourceTreeProvider();
		this.extensionContext.subscriptions.push(this.apiWrapper.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));

		servicePool.accountService.onDidChangeAccounts((e: DidChangeAccountsParams) => { azureResourceTree.notifyNodeChanged(undefined); });

		registerAzureResourceCommands(azureResourceTree);
		registerAzureResourceDatabaseServerCommands();
		registerAzureResourceDatabaseCommands();

		return Promise.resolve(true);
	}

	public deactivate(): void {
	}
}
