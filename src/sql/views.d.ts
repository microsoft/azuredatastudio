/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'views' {
	import * as vscode from 'vscode';
	import * as data from 'data';

	export interface Button {
		label: string;
		readonly onClicked: vscode.Event<any>;
	}

	export interface UIControl {
		type: data.ControlTypes,
		control: any,
		container: string,
		id: number
	}

	export interface ControlEventArgs {
		type: data.ControlTypes,
		id: number,
		event: string
	}
}
