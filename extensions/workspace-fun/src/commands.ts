/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DataWorkspaceFileProvider, JSONFileSystemProvider, DataWorkspaceJsonFile } from './fileSystemProviders';

export class AddFolderCommand {
	public static readonly ID = 'workspaceFun.addFolder';

	static register(): void {
		vscode.commands.registerCommand(AddFolderCommand.ID, () => new AddFolderCommand().run());
	}

	public async run(): Promise<void> {
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: true });
		if (uris) {
			for (const uri of uris) {
				vscode.workspace.updateWorkspaceFolders(0, 0, { name: path.basename(uri.toString()), uri });
			}
		}
	}
}

export class AddJsonCommand {
	public static readonly ID = 'workspaceFun.addJson';

	static register(): void {
		vscode.commands.registerCommand(AddJsonCommand.ID, () => new AddJsonCommand().run());
	}

	public async run(): Promise<void> {
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, filters: { 'json': ['json'] } });
		if (uris) {
			for (const uri of uris) {
				const jsonUri = uri.with({ scheme: JSONFileSystemProvider.ID });
				vscode.workspace.updateWorkspaceFolders(0, 0, { name: path.basename(jsonUri.toString()), uri: jsonUri });
			}
		}
	}
}

export class AddDataWorkspaceCommand {
	public static readonly ID = 'workspaceFun.addDataWorkspace';

	static register(): void {
		vscode.commands.registerCommand(AddDataWorkspaceCommand.ID, () => new AddDataWorkspaceCommand().run());
	}

	public async run(): Promise<void> {
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, filters: { 'json': ['json'] } });
		if (uris) {
			let didFail = false;
			for (const uri of uris) {
				if (await this.validateWorkspaceFile(uri)) {
					const name = (JSON.parse((await vscode.workspace.fs.readFile(uri.with({ scheme: 'file' }))).toString()) as DataWorkspaceJsonFile).name;
					const jsonUri = uri.with({ scheme: DataWorkspaceFileProvider.ID });
					vscode.workspace.updateWorkspaceFolders(0, 0, { name, uri: jsonUri });
				} else {
					didFail = true;
				}
			}
			if (didFail) {
				vscode.window.showErrorMessage('One of more workspace files were invalid and were not added');
			}
		}
	}

	private async validateWorkspaceFile(uri: vscode.Uri): Promise<boolean> {
		try {
			let json = JSON.parse((await vscode.workspace.fs.readFile(uri.with({ scheme: 'file' }))).toString());
			if (Array.isArray(json)) {
				throw new Error('Arrays not valid for workspace json');
			}
			const { connections, files, folders, name } = (json as DataWorkspaceJsonFile);
			if (!name || typeof name !== 'string') {
				throw new Error('name must be a string and be present');
			}
			// if we have connections and it is not an array or every value isn't a string
			if (connections && (!Array.isArray(connections) || connections.some(c => typeof c !== 'string'))) {
				throw new Error('connections must be array of strings');
			}
			if (files && (!Array.isArray(files) || files.some(c => typeof c !== 'string'))) {
				throw new Error('connections must be array of strings');
			}
			if (folders && (!Array.isArray(folders) || folders.some(c => typeof c !== 'string'))) {
				throw new Error('connections must be array of strings');
			}
			return true;
		} catch (e) {
			return false;
		}
	}
}
