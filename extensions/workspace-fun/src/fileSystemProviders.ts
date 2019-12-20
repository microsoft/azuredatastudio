/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DataWorkspaceJsonFile } from './utils';

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
	connections?: vscode.Uri[];
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

		// asking about the workspace itself
		if (extLocation + 5 === uri.path.length) {
			return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
		}

		const path = uri.path.slice(extLocation + 6).split('/');
		const type = path[0] as keyof DataWorkspace;

		if (['files', 'folders', 'connections'].indexOf(type) === -1) {
			throw new Error('invalid uri for files/folders');
		}

		return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
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
			if (dataWorkspace.connections && dataWorkspace.connections.length > 0) {
				children.push(['connections', vscode.FileType.Directory]);
			}
			return children;
		}

		const pathIndex = uri.path.slice(extLocation + 6).split('/');
		const type = pathIndex[0] as keyof DataWorkspace;

		if (['files', 'folders', 'connections'].indexOf(type) === -1) {
			throw new Error('invalid uri for files/folders');
		}

		return Promise.all(dataWorkspace[type]!.map(async f => {
			if (['files', 'folders'].indexOf(type) >= 0) {
				const stat = await vscode.workspace.fs.stat(f);
				return [path.basename(f.fsPath), stat.type, f] as [string, vscode.FileType, vscode.Uri];
			} else {
				return [f.path, vscode.FileType.Directory, f] as [string, vscode.FileType, vscode.Uri];
			}
		}));
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
		if (json.connections) {
			dataWorkspace.connections = json.connections.map(f => vscode.Uri.parse(f));
		}
		return dataWorkspace;
	}

	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		throw new Error('Method not implemented.');
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
		throw new Error('Method not implemented.');
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}
}
