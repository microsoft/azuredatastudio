/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';

export class Dataspace {
	private _name: string;
	private _workspace: vscode.WorkspaceFolder;

	constructor() {
	}

	public get Configuration(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration();
	}

	public get Name(): string {
		return this._name;
	}

	public get Workspace(): vscode.WorkspaceFolder {
		return this._workspace;
	}

	public set Name(value: string) {
		this._name = value;
	}

	public get Settings(): any {
		let wsFile = vscode.workspace.workspaceFile;
		if (wsFile) {
			// tslint:disable-next-line:no-sync
			let content = fs.readFileSync(wsFile.fsPath, 'utf-8');
			let settings = JSON.parse(content);
			return settings;
		} else {
			return undefined;
		}
	}

	public set Workspace(value: vscode.WorkspaceFolder) {
		this._workspace = value;
	}
}
