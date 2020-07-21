/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { azureResource } from '../../azure-resource';
import { IAzureResourceService } from '../../interfaces';
import { SqlInstanceArcTreeDataProvider as SqlInstanceArcTreeDataProvider } from './sqlInstanceArcTreeDataProvider';

export class SqlInstanceArcProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		private _service: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new SqlInstanceArcTreeDataProvider(this._service, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.sqlInstanceArc';
	}
}
