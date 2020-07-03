/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class TestButton implements azdata.window.Button {

	private _onClick = new vscode.EventEmitter<void>();

	///#########################
	// # Button Implementation #
	// #########################

	label!: string;
	enabled!: boolean;
	hidden!: boolean;
	focused?: boolean | undefined;
	onClick: vscode.Event<void> = this._onClick.event;
	position?: 'left' | 'right' | undefined;
}
