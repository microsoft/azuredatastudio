/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TestComponent } from './testComponent';

export class TestCheckbox extends TestComponent implements azdata.CheckBoxComponent {

	private _onChanged = new vscode.EventEmitter<any>();

	///###########################
	// # Checkbox Implementation #
	// ###########################

	public onChanged: vscode.Event<any> = this._onChanged.event;
}
