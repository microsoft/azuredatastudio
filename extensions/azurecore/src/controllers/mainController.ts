/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import ControllerBase from './controllerBase';

import { AzureResourceTreeProvider } from '../azureResource/tree/treeProvider';
import { registerAzureResourceCommands } from '../azureResource/commands';
import { AzureResourceServicePool } from '../azureResource/servicePool';
import { AzureResourceCredentialService } from '../azureResource/services/credentialService';
import { AzureResourceAccountService } from '../azureResource/services/accountService';
import { AzureResourceSubscriptionService } from '../azureResource/services/subscriptionService';
import { AzureResourceSubscriptionFilterService } from '../azureResource/services/subscriptionFilterService';
import { AzureResourceDatabaseServerService } from '../azureResource/services/databaseServerService';
import { AzureResourceDatabaseService } from '../azureResource/services/databaseService';
import { AzureResourceCacheService } from '../azureResource/services/cacheService';
import { AzureResourceContextService } from '../azureResource/services/contextService';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {
	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.configureAzureResource();
		return Promise.resolve(true);
	}

	private configureAzureResource(): void {
		let servicePool = AzureResourceServicePool.getInstance();
		servicePool.cacheService = new AzureResourceCacheService(this.extensionContext);
		servicePool.contextService = new AzureResourceContextService(this.extensionContext, this.apiWrapper);
		servicePool.accountService = new AzureResourceAccountService(this.apiWrapper);
		servicePool.credentialService = new AzureResourceCredentialService(this.apiWrapper);
		servicePool.subscriptionService = new AzureResourceSubscriptionService();
		servicePool.subscriptionFilterService = new AzureResourceSubscriptionFilterService(new AzureResourceCacheService(this.extensionContext));
		servicePool.databaseService = new AzureResourceDatabaseService();
		servicePool.databaseServerService = new AzureResourceDatabaseServerService();

		let azureResourceTree = new AzureResourceTreeProvider();
		this.extensionContext.subscriptions.push(this.apiWrapper.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));

		registerAzureResourceCommands(this.apiWrapper, azureResourceTree);
	}
}
