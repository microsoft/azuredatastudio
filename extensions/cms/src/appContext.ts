/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { ApiWrapper } from './apiWrapper';

/**
 * Global context for the application
 */
export class AppContext {

	private _ownerUri: string;
	private _cmsProvider: sqlops.CmsServiceProvider;

	constructor(public readonly extensionContext: vscode.ExtensionContext, public readonly apiWrapper: ApiWrapper) {
		this.apiWrapper = apiWrapper || new ApiWrapper();
		this._ownerUri = this.apiWrapper.ownerUri;
		this._cmsProvider = this.apiWrapper.getCmsProvider();
	}

	// Getters
	public get ownerUri(): string {
		return this._ownerUri;
	}

	public get cmsProvider(): sqlops.CmsServiceProvider {
		return this._cmsProvider;
	}
}
