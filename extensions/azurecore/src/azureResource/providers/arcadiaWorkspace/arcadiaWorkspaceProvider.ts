/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { azureResource } from '../../azure-resource';
import { IAzureResourceArcadiaWorkspaceService } from './interfaces';
import { AzureResourceArcadiaWorkspaceTreeDataProvider } from './arcadiaWorkspaceTreeDataProvider';

export class AzureResourceArcadiaWorkspaceProvider implements azureResource.IAzureResourceProvider {
	public constructor(
		arcadiaWorkspaceService: IAzureResourceArcadiaWorkspaceService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._arcadiaWorkspaceService = arcadiaWorkspaceService;
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeDataProvider(): azureResource.IAzureResourceTreeDataProvider {
		return new AzureResourceArcadiaWorkspaceTreeDataProvider(this._arcadiaWorkspaceService, this._apiWrapper, this._extensionContext);
	}

	public get providerId(): string {
		return 'azure.resource.providers.arcadiaWorkspace';
	}

	private _arcadiaWorkspaceService: IAzureResourceArcadiaWorkspaceService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;
}
