/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

export interface TestContext {

	outputChannel: vscode.OutputChannel;
	op: azdata.BackgroundOperation;
	getOpStatus: () => azdata.TaskStatus;
}

export function createContext(): TestContext {
	let opStatus: azdata.TaskStatus;

	return {
		outputChannel: {
			name: '',
			append: () => { },
			appendLine: () => { },
			clear: () => { },
			show: () => { },
			hide: () => { },
			dispose: () => { },
			replace: () => { }
		},
		op: {
			updateStatus: (status: azdata.TaskStatus) => {
				opStatus = status;
			},
			id: '',
			onCanceled: new vscode.EventEmitter<void>().event,
		},
		getOpStatus: () => { return opStatus; }
	};
}
