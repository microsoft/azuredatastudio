/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

export class JSONFileSystemProvider implements vscode.FileSystemProvider {
	static readonly ID = 'json';
	static register(): void {
		vscode.workspace.registerFileSystemProvider(JSONFileSystemProvider.ID, new JSONFileSystemProvider());
	}

	private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	public readonly onDidChangeFile = this._onDidChangeFile.event;

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

		return children;
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

interface DataWorkspace {
	folders?: vscode.Uri[];
	files?: vscode.Uri[];
	// connections?: vscode.Uri[];
}

export interface DataWorkspaceJsonFile {
	name: string;
	folders?: string[];
	files?: string[];
	connections?: string[];
}

export class DataWorkspaceFileProvider implements vscode.FileSystemProvider {
	static readonly ID = 'dataworkspace';
	static register(): void {
		vscode.workspace.registerFileSystemProvider(DataWorkspaceFileProvider.ID, new DataWorkspaceFileProvider());
	}

	private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	public readonly onDidChangeFile = this._onDidChangeFile.event;

	private workspaces = new Map<vscode.Uri, DataWorkspace>();

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		return vscode.workspace.createFileSystemWatcher(uri.fsPath);
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		const extLocation = uri.path.lastIndexOf('.json');
		const file = uri.path.slice(0, extLocation + 5);
		const dataWorkspace = await this.asWorkspace(uri.with({ scheme: 'file', path: file }));

		// asking about the workspace itself
		if (extLocation + 5 === uri.path.length) {
			return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
		}

		const path = uri.path.slice(extLocation + 6).split('/');
		const type = path[0] as 'files' | 'folders';
		const index = path[1];
		const uriIndex = path.slice(2).join('/');

		if (['files', 'folders'].indexOf(type) === -1) {
			throw new Error('invalid uri for files/folders');
		}

		if (!index) {
			return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
		} else {
			const assetUri = dataWorkspace[type]!.find(f => f.fsPath === index);
			if (!assetUri) {
				throw new Error('invalid uri for index path');
			}
			if (uriIndex) {
				return vscode.workspace.fs.stat(assetUri.with({ path: assetUri.path + '/' + uriIndex }));
			} else {
				return vscode.workspace.fs.stat(assetUri);
			}
		}
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType, vscode.Uri?][]> {
		const extLocation = uri.path.lastIndexOf('.json');
		const file = uri.path.slice(0, extLocation + 5);
		const dataWorkspace = await this.asWorkspace(uri.with({ scheme: 'file', path: file }));

		// asking about the workspace itself
		if (extLocation + 5 === uri.path.length) {
			let children: [string, vscode.FileType][] = [];
			if (dataWorkspace.files && dataWorkspace.files.length > 0) {
				children.push(['files', vscode.FileType.Directory]);
			}
			if (dataWorkspace.folders && dataWorkspace.folders.length > 0) {
				children.push(['folders', vscode.FileType.Directory]);
			}
			return children;
		}

		const pathIndex = uri.path.slice(extLocation + 6).split('/');
		const type = pathIndex[0] as 'files' | 'folders';
		// const index = pathIndex[1];
		// const uriIndex = pathIndex.slice(2).join('/');

		if (['files', 'folders'].indexOf(type) === -1) {
			throw new Error('invalid uri for files/folders');
		}

		// if (!index) {
		return Promise.all(dataWorkspace[type]!.map(async f => {
			const stat = await vscode.workspace.fs.stat(f);
			return [path.basename(f.fsPath), stat.type, f] as [string, vscode.FileType, vscode.Uri];
		}));
		// } else {
		// 	const assetUri = dataWorkspace[type]!.find(f => f.fsPath === index);
		// 	if (!assetUri) {
		// 		throw new Error('invalid uri for index path');
		// 	}
		// 	if (uriIndex) {
		// 		const stats = await vscode.workspace.fs.readDirectory(assetUri.with({ path: assetUri.path + '/' + uriIndex }));
		// 		return stats.map(([name, type]) => [name, type, assetUri.with({ path: assetUri.path + '/' + uriIndex + '/' + name })]);
		// 	} else {
		// 		const stats = await vscode.workspace.fs.readDirectory(assetUri);
		// 		return stats.map(([name, type]) => [name, type, assetUri.with({ path: assetUri.path + '/' + name })]);
		// 	}
		// }
	}

	private async asWorkspace(uri: vscode.Uri): Promise<DataWorkspace> {
		if (this.workspaces.get(uri)) {
			return this.workspaces.get(uri)!;
		}
		let json = JSON.parse((await vscode.workspace.fs.readFile(uri)).toString()) as DataWorkspaceJsonFile;
		let dataWorkspace = Object.create(null);
		delete json.name;
		if (json.files) {
			dataWorkspace.files = json.files.map(f => vscode.Uri.file(f));
		}
		if (json.folders) {
			dataWorkspace.folders = json.folders.map(f => vscode.Uri.file(f));
		}
		return dataWorkspace;
	}

	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const extLocation = uri.path.lastIndexOf('.json');
		const file = uri.path.slice(0, extLocation + 5);
		const dataWorkspace = await this.asWorkspace(uri.with({ scheme: 'file', path: file }));

		const path = uri.path.slice(extLocation + 6).split('/');
		const type = path[0] as 'files' | 'folders';
		const index = path[1];
		const uriIndex = path.slice(2).join('/');

		if (['files', 'folders'].indexOf(type) === -1) {
			throw new Error('invalid uri for files/folders');
		}

		const assetUri = dataWorkspace[type]!.find(f => f.fsPath === index);
		if (!assetUri) {
			throw new Error('invalid uri for index path');
		}
		if (uriIndex) {
			return vscode.workspace.fs.readFile(assetUri.with({ path: assetUri.path + '/' + uriIndex }));
		} else {
			return vscode.workspace.fs.readFile(assetUri);
		}
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
		const extLocation = uri.path.lastIndexOf('.json');
		const file = uri.path.slice(0, extLocation + 5);
		const dataWorkspace = await this.asWorkspace(uri.with({ scheme: 'file', path: file }));

		const path = uri.path.slice(extLocation + 6).split('/');
		const type = path[0] as 'files' | 'folders';
		const index = path[1];
		const uriIndex = path.slice(2).join('/');

		if (['files', 'folders'].indexOf(type) === -1) {
			throw new Error('invalid uri for files/folders');
		}

		const assetUri = dataWorkspace[type]!.find(f => f.fsPath === index);
		if (!assetUri) {
			throw new Error('invalid uri for index path');
		}
		if (uriIndex) {
			return vscode.workspace.fs.writeFile(assetUri.with({ path: assetUri.path + '/' + uriIndex }), content);
		} else {
			return vscode.workspace.fs.writeFile(assetUri, content);
		}
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
