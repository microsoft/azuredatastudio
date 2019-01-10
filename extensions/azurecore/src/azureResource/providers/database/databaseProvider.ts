/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { azureResource } from '../../azure-resource';
import { IAzureResourceDatabaseService } from './interfaces';
import { AzureResourceDatabaseTreeDataProvider } from './databaseTreeDataProvider';

export class AzureResourceDatabaseProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		databaseService: IAzureResourceDatabaseService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._databaseService = databaseService;
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceDatabaseTreeDataProvider(this._databaseService, this._apiWrapper, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.database';
	}

	private _databaseService: IAzureResourceDatabaseService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;
}