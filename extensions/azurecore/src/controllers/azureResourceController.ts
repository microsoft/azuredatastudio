/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import ControllerBase from './controllerBase';
import { DidChangeAccountsParams } from 'sqlops';

import {
	IAzureResourceCacheService,
	IAzureResourceAccountService,
	IAzureResourceSubscriptionService,
	IAzureResourceSubscriptionFilterService,
	IAzureResourceTenantService } from '../azureResource/interfaces';
import { AzureResourceServiceNames } from '../azureResource/constants';
import { AzureResourceTreeProvider } from '../azureResource/tree/treeProvider';
import { registerAzureResourceCommands } from '../azureResource/commands';
import { AzureResourceAccountService } from '../azureResource/services/accountService';
import { AzureResourceSubscriptionService } from '../azureResource/services/subscriptionService';
import { AzureResourceSubscriptionFilterService } from '../azureResource/services/subscriptionFilterService';
import { AzureResourceCacheService } from '../azureResource/services/cacheService';
import { AzureResourceTenantService } from '../azureResource/services/tenantService';

import { registerAzureResourceDatabaseServerCommands } from '../azureResource/providers/databaseServer/commands';
import { registerAzureResourceDatabaseCommands } from '../azureResource/providers/database/commands';

export default class AzureResourceController extends ControllerBase {
	public activate(): Promise<boolean> {
		this.appContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, new AzureResourceCacheService(this.extensionContext));
		this.appContext.registerService<IAzureResourceAccountService>(AzureResourceServiceNames.accountService, new AzureResourceAccountService(this.apiWrapper));
		this.appContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, new AzureResourceSubscriptionService());
		this.appContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, new AzureResourceSubscriptionFilterService(new AzureResourceCacheService(this.extensionContext)));
		this.appContext.registerService<IAzureResourceTenantService>(AzureResourceServiceNames.tenantService, new AzureResourceTenantService());

		const azureResourceTree = new AzureResourceTreeProvider(this.appContext);
		this.extensionContext.subscriptions.push(this.apiWrapper.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));

		this.appContext.getService<IAzureResourceAccountService>(AzureResourceServiceNames.accountService).onDidChangeAccounts((e: DidChangeAccountsParams) => { azureResourceTree.notifyNodeChanged(undefined); });

		registerAzureResourceCommands(this.appContext, azureResourceTree);

		registerAzureResourceDatabaseServerCommands(this.appContext);

		registerAzureResourceDatabaseCommands(this.appContext);

		return Promise.resolve(true);
	}

	public deactivate(): void {
	}
}
