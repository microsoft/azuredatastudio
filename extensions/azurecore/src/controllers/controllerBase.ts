/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

import { AppContext } from '../appContext';
import { ApiWrapper } from '../apiWrapper';

export default abstract class ControllerBase implements vscode.Disposable {

	public constructor(protected appContext: AppContext) {
	}

	protected get apiWrapper(): ApiWrapper {
		return this.appContext.apiWrapper;
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.appContext && this.appContext.extensionContext;
	}

	abstract activate(): Promise<boolean>;

	abstract deactivate(): void;

	public dispose(): void {
		this.deactivate();
	}
}

