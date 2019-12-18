/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

export function activate() {
	vscode.commands.registerCommand('workspaceFun.addFolder', async () => {
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: true });
		if (uris) {
			for (const uri of uris) {
				vscode.workspace.updateWorkspaceFolders(0, 0, { name: path.basename(uri.toString()), uri });
			}
		}
	});
	vscode.commands.registerCommand('workspaceFun.addJson', async () => {
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, filters: { 'json': ['json'] } });
		if (uris) {
			for (const uri of uris) {
				const jsonUri = uri.with({ scheme: 'json' });
				vscode.workspace.updateWorkspaceFolders(0, 0, { name: path.basename(jsonUri.toString()), uri: jsonUri });
			}
		}
	});

	vscode.workspace.registerFileSystemProvider('json', new JSONFileSystemProvider());
}


class JSONFileSystemProvider implements vscode.FileSystemProvider {
	private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	public readonly onDidChangeFile = this._onDidChangeFile.event;

	private childrenMap = new Map<vscode.Uri, [string, vscode.FileType][]>();

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		return vscode.workspace.createFileSystemWatcher(uri.fsPath);
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		const extLocation = uri.path.lastIndexOf('.json');
		const file = uri.path.slice(0, extLocation + 5);
		let json = JSON.parse((await vscode.workspace.fs.readFile(uri.with({ scheme: 'file', path: file }))).toString());

		if (extLocation + 5 !== uri.path.length) {
			const indexPath = uri.path.slice(extLocation + 6);
			for (const index of indexPath.split('/')) {
				json = json[index];
			}

			const type = typeof json as 'string' | 'number' | 'boolean' | 'object';
			if (['string', 'number', 'boolean'].includes(type)) {
				return { size: 0, ctime: 0, mtime: 0, type: vscode.FileType.Unknown };
			} else {
				return { size: 0, ctime: 0, mtime: 0, type: vscode.FileType.Directory };
			}
		} else {
			const stats = await vscode.workspace.fs.stat(uri.with({ scheme: 'file' }));
			return { size: stats.size, ctime: stats.ctime, mtime: stats.mtime, type: vscode.FileType.Directory };
		}
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		if (!this.childrenMap.has(uri)) {
			const extLocation = uri.path.lastIndexOf('.json');
			const file = uri.path.slice(0, extLocation + 5);
			let json = JSON.parse((await vscode.workspace.fs.readFile(uri.with({ scheme: 'file', path: file }))).toString());
			let children: [string, vscode.FileType][];

			if (extLocation + 5 !== uri.path.length) {
				const indexPath = uri.path.slice(extLocation + 6);
				for (const index of indexPath.split('/')) {
					json = json[index];
				}
			}

			if (Array.isArray(json)) {
				children = json.map((v, i) => {
					const type = typeof v as 'string' | 'number' | 'boolean' | 'object';
					if (['string', 'number', 'boolean'].includes(type)) {
						return [i.toString(), vscode.FileType.Unknown];
					} else {
						return [i.toString(), vscode.FileType.Directory];
					}
				});
			} else {
				children = Object.keys(json).map(k => {
					const type = typeof json[k] as 'string' | 'number' | 'boolean' | 'object';
					if (type === 'object') {
						return [k, vscode.FileType.Directory];
					} else {
						return [k, vscode.FileType.Unknown];
					}
				});
			}

			this.childrenMap.set(uri, children);
		}

		return this.childrenMap.get(uri)!;
	}

	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		throw new Error('Method not implemented.');
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
