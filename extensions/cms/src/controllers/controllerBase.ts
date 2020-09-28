/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { AppContext } from '../appContext';

export default abstract class ControllerBase implements vscode.Disposable {

	public constructor(protected appContext: AppContext) {
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
