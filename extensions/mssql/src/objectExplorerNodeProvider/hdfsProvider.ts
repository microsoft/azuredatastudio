/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fspath from 'path';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as Constants from '../constants';
import { IFileSource, IFile, File, FileType } from './fileSources';
import { CancelableStream } from './cancelableStream';
import { TreeNode } from './treeNodes';
import * as utils from '../utils';
import { IFileNode } from './types';
import { MountStatus } from '../hdfs/mount';

export interface ITreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}
export class TreeDataContext {

	constructor(public extensionContext: vscode.ExtensionContext, public changeHandler: ITreeChangeHandler) {

	}
}

export abstract class HdfsFileSourceNode extends TreeNode {
	constructor(protected context: TreeDataContext, protected _path: string, public readonly fileSource: IFileSource, protected mountStatus?: MountStatus) {
		super();
	}

	public get hdfsPath(): string {
		return this._path;
	}

	public get nodePathValue(): string {
		return this.getDisplayName();
	}


	protected isMounted(): boolean {
		return this.mountStatus === MountStatus.Mount || this.mountStatus === MountStatus.Mount_Child;
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

export class FolderNode extends HdfsFileSourceNode {
	private children: TreeNode[];
	protected _nodeType: string;
	constructor(context: TreeDataContext, path: string, fileSource: IFileSource, nodeType?: string, mountStatus?: MountStatus) {
		super(context, path, fileSource, mountStatus);
		this._nodeType = nodeType ? nodeType : Constants.MssqlClusterItems.Folder;
	}

	private ensureChildrenExist(): void {
		if (!this.children) {
			this.children = [];
		}
	}

	public onChildRemoved(): void {
		this.children = undefined;
	}

	async getChildren(refreshChildren: boolean): Promise<TreeNode[]> {
		if (refreshChildren || !this.children) {
			this.ensureChildrenExist();
			try {
				let files: IFile[] = await this.fileSource.enumerateFiles(this._path);
				if (files) {
					// Note: for now, assuming HDFS-provided sorting is sufficient
					this.children = files.map((file) => {
						let node: TreeNode = file.fileType === FileType.File ?
							new FileNode(this.context, file.path, this.fileSource, this.getChildMountStatus(file)) :
							new FolderNode(this.context, file.path, this.fileSource, Constants.MssqlClusterItems.Folder, this.getChildMountStatus(file));
						node.parent = this;
						return node;
					});
				}
			} catch (error) {
				this.children = [ErrorNode.create(localize('errorExpanding', "Error: {0}", utils.getErrorMessage(error)), this, error.statusCode)];
			}
		}
		return this.children;
	}

	private getChildMountStatus(file: IFile): MountStatus {
		if (file.mountStatus !== undefined && file.mountStatus !== MountStatus.None) {
			return file.mountStatus;
		}
		else if (this.mountStatus !== undefined && this.mountStatus !== MountStatus.None) {
			// Any child node of a mount (or subtree) must be a mount child
			return MountStatus.Mount_Child;
		}
		return MountStatus.None;
	}

	getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		let item = new vscode.TreeItem(this.getDisplayName(), vscode.TreeItemCollapsibleState.Collapsed);
		// For now, folder always looks the same. We're using SQL icons to differentiate remote vs local files
		item.iconPath = {
			dark: this.context.extensionContext.asAbsolutePath('resources/light/Folder.svg'),
			light: this.context.extensionContext.asAbsolutePath('resources/light/Folder.svg')
		};
		item.contextValue = this._nodeType;
		return item;
	}

	getNodeInfo(): azdata.NodeInfo {
		// TODO handle error message case by returning it in the OE API
		// TODO support better mapping of node type
		let nodeInfo: azdata.NodeInfo = {
			label: this.getDisplayName(),
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: this._nodeType,
			nodeSubType: this.getSubType(),
			iconType: this.isMounted() ? 'Folder_mounted' : 'Folder'
		};
		return nodeInfo;
	}

	private getSubType(): string | undefined {
		if (this.mountStatus === MountStatus.Mount) {
			return Constants.MssqlClusterItemsSubType.Mount;
		} else if (this.mountStatus === MountStatus.Mount_Child) {
			return Constants.MssqlClusterItemsSubType.MountChild;
		}

		return undefined;
	}

	public async writeFile(localFile: IFile): Promise<FileNode> {
		return this.runChildAddAction<FileNode>(() => this.writeFileAsync(localFile));
	}

	private async writeFileAsync(localFile: IFile): Promise<FileNode> {
		await this.fileSource.writeFile(localFile, this._path);
		let fileNode = new FileNode(this.context, File.createPath(this._path, File.getBasename(localFile)), this.fileSource);
		return fileNode;
	}

	public async mkdir(name: string): Promise<FolderNode> {
		return this.runChildAddAction<FolderNode>(() => this.mkdirAsync(name));
	}

	private async mkdirAsync(name: string): Promise<FolderNode> {
		await this.fileSource.mkdir(name, this._path);
		let subDir = new FolderNode(this.context, File.createPath(this._path, name), this.fileSource);
		return subDir;
	}

	private async runChildAddAction<T extends TreeNode>(action: () => Promise<T>): Promise<T> {
		let node = await action();
		await this.getChildren(true);
		if (this.children) {
			// Find the child matching the node. This is necessary
			// since writing can add duplicates.
			node = this.children.find(n => n.nodePathValue === node.nodePathValue) as T;
			this.context.changeHandler.notifyNodeChanged(this);
		} else {
			// Failed to retrieve children from server so something went wrong
			node = undefined;
		}
		return node;
	}
}

export class ConnectionNode extends FolderNode {

	constructor(context: TreeDataContext, private displayName: string, fileSource: IFileSource) {
		super(context, '/', fileSource, Constants.MssqlClusterItems.Connection);
	}

	getDisplayName(): string {
		return this.displayName;
	}

	public async delete(): Promise<void> {
		throw new Error(localize('errDeleteConnectionNode', "Cannot delete a connection. Only subfolders and files can be deleted."));
	}

	async getTreeItem(): Promise<vscode.TreeItem> {
		let item = await super.getTreeItem();
		item.contextValue = this._nodeType;
		return item;
	}

	getNodeInfo(): azdata.NodeInfo {
		// TODO handle error message case by returning it in the OE API
		// TODO support better mapping of node type
		let nodeInfo: azdata.NodeInfo = {
			label: this.getDisplayName(),
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: 'mssqlCluster:hdfs',
			nodeSubType: undefined,
			iconType: 'Folder'
		};
		return nodeInfo;
	}
}

export class FileNode extends HdfsFileSourceNode implements IFileNode {

	constructor(context: TreeDataContext, path: string, fileSource: IFileSource, mountStatus?: MountStatus) {
		super(context, path, fileSource, mountStatus);
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
		item.contextValue = Constants.MssqlClusterItems.File;
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
			nodeStatus: undefined,
			nodeType: Constants.MssqlClusterItems.File,
			nodeSubType: this.getSubType(),
			iconType: this.isMounted() ? 'FileGroupFile_mounted' : 'FileGroupFile'
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
			readStream.on('error', (err) => {
				reject(err);
			});

			let error: string | Error = undefined;
			let writeStream = fs.createWriteStream(localPath, {
				encoding: 'utf8'
			});
			writeStream.on('error', (err) => {
				error = err;
				reject(error);
			});
			writeStream.on('finish', () => {
				if (!error) {
					resolve(vscode.Uri.file(localPath));
				}
			});

			let cancelable = new CancelableStream(cancelToken);
			cancelable.on('error', (err) => {
				reject(err);
			});

			readStream.pipe(cancelable).pipe(writeStream);
		});
	}

	private getSubType(): string | undefined {
		let subType = '';
		if (this.getDisplayName().toLowerCase().endsWith('.jar') || this.getDisplayName().toLowerCase().endsWith('.py')) {
			subType += Constants.MssqlClusterItemsSubType.Spark;
		} else if (this.mountStatus === MountStatus.Mount_Child) {
			subType += Constants.MssqlClusterItemsSubType.MountChild;
		}

		return subType.length > 0 ? subType : undefined;
	}
}

class ErrorNode extends TreeNode {
	static messageNum: number = 0;

	private _nodePathValue: string;
	constructor(private message: string) {
		super();
	}

	public static create(message: string, parent: TreeNode, errorCode?: number): ErrorNode {
		let node = new ErrorNode(message);
		node.parent = parent;
		if (errorCode) {
			node.errorStatusCode = errorCode;
		}
		return node;
	}

	private ensureNodePathValue(): void {
		if (!this._nodePathValue) {
			this._nodePathValue = `message_${ErrorNode.messageNum++}`;
		}
	}

	public get nodePathValue(): string {
		this.ensureNodePathValue();
		return this._nodePathValue;
	}

	public getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		let item = new vscode.TreeItem(this.message, vscode.TreeItemCollapsibleState.None);
		item.contextValue = Constants.MssqlClusterItems.Error;
		return item;
	}


	getNodeInfo(): azdata.NodeInfo {
		let nodeInfo: azdata.NodeInfo = {
			label: this.message,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: Constants.MssqlClusterItems.Error,
			nodeSubType: undefined,
			iconType: 'MessageType'
		};
		return nodeInfo;
	}
}
