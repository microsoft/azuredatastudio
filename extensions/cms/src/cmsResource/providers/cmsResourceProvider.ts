/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../../apiWrapper';

import { cmsResource } from '../cms-resource';
import { CmsRegisteredServerTreeDataProvider } from './cmsRegisteredServerTreeDataProvider';

export class CmsResourceProvider implements cmsResource.ICmsResourceProvider {
	public constructor(
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeDataProvider(): cmsResource.ICmsResourceTreeDataProvider {
		return new CmsRegisteredServerTreeDataProvider(this._apiWrapper, this._extensionContext);
	}

	public get providerId(): string {
		return 'cms.cmsProvider';
	}

	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;
}