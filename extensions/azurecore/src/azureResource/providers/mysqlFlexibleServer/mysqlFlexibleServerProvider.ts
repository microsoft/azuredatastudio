/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { azureResource } from 'azurecore';
import { IAzureResourceService } from '../../interfaces';
import { MysqlFlexibleServerTreeDataProvider } from './mysqlFlexibleServerTreeDataProvider';

export class MysqlFlexibleServerProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new MysqlFlexibleServerTreeDataProvider(this._databaseServerService, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.mysqlFlexibleServer';
	}
}
