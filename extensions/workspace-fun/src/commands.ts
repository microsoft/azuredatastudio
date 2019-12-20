/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DataWorkspaceFileProvider, JSONFileSystemProvider } from './fileSystemProviders';
import { validateWorkspaceFile, DataWorkspaceJsonFile, addUriToSpace, uriFromConnection } from './utils';

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
				if (await validateWorkspaceFile(uri)) {
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
}

export class AddConnectionsToWorkspaceCommand {
	public static readonly ID = 'workspaceFun.addConnectionToWorkspace';
	static register(): void {
		vscode.commands.registerCommand(AddConnectionsToWorkspaceCommand.ID, () => new AddConnectionsToWorkspaceCommand().run());
	}

	public async run(): Promise<void> {
		try {
			const azdata = await import('azdata');
			const connections = await azdata.connection.getConnections();
			const selected = await vscode.window.showQuickPick(connections.map(c => c.serverName));
			if (selected) {
				const selectedConnection = connections.find(c => c.serverName === selected)!;
				const spaces = vscode.workspace.workspaceFolders;
				if (spaces && spaces.length > 0) {
					let space: vscode.Uri;
					if (spaces.length === 1) {
						if (spaces[0].uri.scheme === DataWorkspaceFileProvider.ID) {
							space = spaces[0].uri;
						} else {
							vscode.window.showErrorMessage('Must have at least 1 data space open');
							return;
						}
					} else {
						const pickSpaces = spaces.filter(s => s.uri.scheme === DataWorkspaceFileProvider.ID);
						if (pickSpaces.length === 0) {
							vscode.window.showErrorMessage('Must have at least 1 data space open');
							return;
						}
						const selectedSpace = await vscode.window.showQuickPick(pickSpaces.map(s => s.name));
						if (selectedSpace) {
							space = pickSpaces.find(c => c.name === selectedSpace)!.uri;
						} else {
							return;
						}
					}
					await addUriToSpace(space.with({ scheme: 'file' }), 'connections', uriFromConnection(selectedConnection));
				} else {
					vscode.window.showErrorMessage('Must have a workspace open');
				}
			}
		} catch (e) {
			vscode.window.showErrorMessage('Can only add connections in Azure Data Studio');
		}
	}
}
