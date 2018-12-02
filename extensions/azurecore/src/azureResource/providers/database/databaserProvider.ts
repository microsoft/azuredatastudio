/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { azureResource } from 'sqlops';
import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { IAzureResourceDatabaseService } from './interfaces';
import { AzureResourceDatabaseTreeDataProvider } from './databaseTreeDataProvider';

export class AzureResourceDatabaseProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		public databaseService: IAzureResourceDatabaseService,
		public apiWrapper: ApiWrapper,
		public extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceDatabaseTreeDataProvider(this.databaseService, this.apiWrapper, this.extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.database';
	}
}