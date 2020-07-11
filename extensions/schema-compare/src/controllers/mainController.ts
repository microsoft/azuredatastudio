/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, ExtensionContext } from 'vscode';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { ApiWrapper } from '../common/apiWrapper';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements Disposable {
	protected schemaCompareMainWindow: SchemaCompareMainWindow;

	public constructor(private context: ExtensionContext, private apiWrapper: ApiWrapper) {
		this.schemaCompareMainWindow = new SchemaCompareMainWindow(this.apiWrapper, null, this.extensionContext);
	}

	public get extensionContext(): ExtensionContext {
		return this.context;
	}

	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.initializeSchemaCompareDialog();
		return Promise.resolve(true);
	}

	private initializeSchemaCompareDialog(): void {
		this.apiWrapper.registerCommand('schemaCompare.start', async (context: any) => { await this.schemaCompareMainWindow.start(context); });
	}

	public dispose(): void {
		this.deactivate();
	}
}
