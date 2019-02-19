/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { azureResource } from '../../azure-resource';
import { IAzureResourceDatabaseServerService } from './interfaces';
import { AzureResourceDatabaseServerTreeDataProvider } from './databaseServerTreeDataProvider';

export class AzureResourceDatabaseServerProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		databaseServerService: IAzureResourceDatabaseServerService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._databaseServerService = databaseServerService;
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceDatabaseServerTreeDataProvider(this._databaseServerService, this._apiWrapper, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.databaseServer';
	}

	private _databaseServerService: IAzureResourceDatabaseServerService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;
}