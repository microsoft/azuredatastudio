/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { azureResource } from 'sqlops';
import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { IAzureResourceDatabaseServerService } from './interfaces';
import { AzureResourceDatabaseServerTreeDataProvider } from './databaseServerTreeDataProvider';

export class AzureResourceDatabaseServerProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		public databaseServerService: IAzureResourceDatabaseServerService,
		public apiWrapper: ApiWrapper,
		public extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceDatabaseServerTreeDataProvider(this.databaseServerService, this.apiWrapper, this.extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.databaseServer';
	}
}