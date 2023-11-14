/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fspath from 'path';
import * as fs from 'fs';
import * as Constants from './constants';
import { IFileSource } from './fileSources';
import { CancelableStream } from './cancelableStream';
import { TreeNode } from './treeNodes';
import { IFileNode } from './types';

export interface ITreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}
export class TreeDataContext {
	constructor(public extensionContext: vscode.ExtensionContext, public changeHandler: ITreeChangeHandler) { }
}

export abstract class HdfsFileSourceNode extends TreeNode {
	constructor(protected context: TreeDataContext, protected _path: string, protected fileSource: IFileSource) {
		super();
	}

	public get hdfsPath(): string {
		return this._path;
	}

	public get nodePathValue(): string {
		return this.getDisplayName();
	}

	getDisplayName(): string {
		return fspath.basename(this._path);
	}

	public async delete(recursive: boolean = false): Promise<void> {
		await this.fileSource.delete(this.hdfsPath, recursive);
		// Notify parent should be updated. If at top, will return undefined which will refresh whole tree
		(<HdfsFileSourceNode>this.parent).onChildRemoved();
		this.context.changeHandler.notifyNodeChanged(this.parent);
	}
	public abstract onChildRemoved(): void;
}

export class FileNode extends HdfsFileSourceNode implements IFileNode {

	constructor(context: TreeDataContext, path: string, fileSource: IFileSource) {
		super(context, path, fileSource);
	}

	public onChildRemoved(): void {
		// do nothing
	}

	getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		let item = new vscode.TreeItem(this.getDisplayName(), vscode.TreeItemCollapsibleState.None);
		item.iconPath = {
			dark: this.context.extensionContext.asAbsolutePath('resources/dark/file_inverse.svg'),
			light: this.context.extensionContext.asAbsolutePath('resources/light/file.svg')
		};
		item.contextValue = Constants.HdfsItems.File;
		return item;
	}


	getNodeInfo(): azdata.NodeInfo {
		// TODO improve node type handling so it's not tied to SQL Server types
		let nodeInfo: azdata.NodeInfo = {
			label: this.getDisplayName(),
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			parentNodePath: this.parent?.generateNodePath() ?? '',
			nodeStatus: undefined,
			nodeType: Constants.HdfsItems.File,
			nodeSubType: this.getSubType(),
			iconType: 'FileGroupFile'
		};
		return nodeInfo;
	}

	public async getFileContentsAsString(maxBytes?: number): Promise<string> {
		let contents: Buffer = await this.fileSource.readFile(this.hdfsPath, maxBytes);
		return contents ? contents.toString('utf8') : '';
	}

	public async getFileLinesAsString(maxLines: number): Promise<string> {
		let contents: Buffer = await this.fileSource.readFileLines(this.hdfsPath, maxLines);
		return contents ? contents.toString('utf8') : '';
	}

	public writeFileContentsToDisk(localPath: string, cancelToken?: vscode.CancellationTokenSource): Promise<vscode.Uri> {
		return new Promise((resolve, reject) => {
			let readStream: fs.ReadStream = this.fileSource.createReadStream(this.hdfsPath);
			let writeStream = fs.createWriteStream(localPath, {
				encoding: 'utf8'
			});
			let cancelable = new CancelableStream(cancelToken);
			cancelable.on('error', (err) => {
				reject(err);
			});
			readStream.pipe(cancelable).pipe(writeStream);

			let error: string | Error = undefined;

			writeStream.on('error', (err) => {
				error = err;
				reject(error);
			});
			writeStream.on('finish', (location) => {
				if (!error) {
					resolve(vscode.Uri.file(localPath));
				}
			});
		});
	}

	private getSubType(): string {
		if (this.getDisplayName().toLowerCase().endsWith('.jar') || this.getDisplayName().toLowerCase().endsWith('.py')) {
			return Constants.HdfsItemsSubType.Spark;
		}

		return undefined;
	}
}
