/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TestModelBuilder } from './testModelBuilder';

export class TestModelView implements azdata.ModelView {

	private _onClosed = new vscode.EventEmitter<any>();
	private _onValidityChanged = new vscode.EventEmitter<boolean>();

	///############################
	// # ModelView Implementation #
	// ############################
	public onClosed: vscode.Event<any> = this._onClosed.event;
	public connection!: azdata.connection.Connection;
	public serverInfo!: azdata.ServerInfo;
	public modelBuilder: azdata.ModelBuilder = new TestModelBuilder();
	public valid!: boolean;
	public onValidityChanged: vscode.Event<boolean> = this._onValidityChanged.event;
	public validate(): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	public async initializeModel<T extends azdata.Component>(_root: T): Promise<void> { }

}
