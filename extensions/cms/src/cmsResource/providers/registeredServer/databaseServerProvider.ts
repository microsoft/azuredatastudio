/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../../apiWrapper';

import { cmsResource } from '../../cms-resource';
import { ICmsResourceRegisteredServerService } from './interfaces';
import { CmsRegisteredServerTreeDataProvider } from './databaseServerTreeDataProvider';

export class AzureResourceDatabaseServerProvider implements cmsResource.ICmsResourceProvider {
	public constructor(
		databaseServerService: ICmsResourceRegisteredServerService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._databaseServerService = databaseServerService;
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeDataProvider(): cmsResource.ICmsResourceTreeDataProvider {
		return new CmsRegisteredServerTreeDataProvider(this._databaseServerService, this._apiWrapper, this._extensionContext);
	}

	public get providerId(): string {
		return 'cms.resource.providers.registeredServer';
	}

	private _databaseServerService: ICmsResourceRegisteredServerService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;
}