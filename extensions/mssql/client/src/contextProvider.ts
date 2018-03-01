/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

export default class ContextProvider {

	constructor() {


		vscode.workspace.onDidChangeTextDocument(e => {
			console.log(e);
		});
	}

	public onDashboardOpen(): void {

	}
}
