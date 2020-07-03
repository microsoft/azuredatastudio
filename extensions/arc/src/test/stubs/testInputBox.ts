/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TestComponent } from './testComponent';

export class TestInputBox extends TestComponent implements azdata.InputBoxComponent {

	private _onTextChanged = new vscode.EventEmitter<any>();
	private _onEnterKeyPressed = new vscode.EventEmitter<string>();

	///####################################
	// # InputBoxComponent Implementation #
	// ####################################

	public onTextChanged: vscode.Event<any> = this._onTextChanged.event;
	public onEnterKeyPressed: vscode.Event<string> = this._onEnterKeyPressed.event;
}
