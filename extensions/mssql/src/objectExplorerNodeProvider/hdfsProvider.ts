/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as fspath from 'path';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ApiWrapper } from '../apiWrapper';
import * as Constants from '../constants';
import { IFileSource, IHdfsOptions, HdfsFileSource, IFile, File, FileSourceFactory } from './fileSources';
import { CancelableStream } from './cancelableStream';
import { TreeNode } from './treeNodes';
import * as utils from '../utils';
import { IFileNode } from './types';

export interface ITreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}
export class TreeDataContext {

	constructor(public extensionContext: vscode.ExtensionContext, public changeHandler: ITreeChangeHandler) {

	}
}

export class HdfsProvider implements vscode.TreeDataProvider<TreeNode>, ITreeChangeHandler {
	static readonly NoConnectionsMessage = 'No connections added';
	static readonly ConnectionsLabel = 'Connections';

	private connections: ConnectionNode[];
	private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode>();
	private context: TreeDataContext;

	constructor(extensionContext: vscode.ExtensionContext, private vscodeApi: ApiWrapper) {
		this.connections = [];
		this.context = new TreeDataContext(extensionContext, this);
	}

	public get onDidChangeTreeData(): vscode.Event<TreeNode> {
		return this._onDidChangeTreeData.event;
	}

	getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.getTreeItem();
	}

	getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
		if (element) {
			return element.getChildren(false);
		} else {
			return this.connections.length > 0 ? this.connections : [ErrorNode.create(HdfsProvider.NoConnectionsMessage, element)];
		}
	}

	addConnection(displayName: string, fileSource: IFileSource): void {
		if (!this.connections.find(c => c.getDisplayName() === displayName)) {
			this.connections.push(new ConnectionNode(this.context, displayName, fileSource));
			this._onDidChangeTreeData.fire();
		}
	}

	addHdfsConnection(options: IHdfsOptions): void {
		let displayName = `${options.user}@${options.host}:${options.port}`;
		let fileSource = FileSourceFactory.instance.createHdfsFileSource(options);
		this.addConnection(displayName, fileSource);
	}

	notifyNodeChanged(node: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}
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

export class FolderNode extends HdfsFileSourceNode {
	private children: TreeNode[];
	protected _nodeType: string;
	constructor(context: TreeDataContext, path: string, fileSource: IFileSource, nodeType?: string) {
		super(context, path, fileSource);
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
						let node: TreeNode = file.isDirectory ? new FolderNode(this.context, file.path, this.fileSource)
							: new FileNode(this.context, file.path, this.fileSource);
						node.parent = this;
						return node;
					});
				}
			} catch (error) {
				this.children = [ErrorNode.create(localize('errorExpanding', 'Error: {0}', utils.getErrorMessage(error)), this)];
			}
		}
		return this.children;
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

	getNodeInfo(): sqlops.NodeInfo {
		// TODO handle error message case by returning it in the OE API
		// TODO support better mapping of node type
		let nodeInfo: sqlops.NodeInfo = {
			label: this.getDisplayName(),
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: this._nodeType,
			nodeSubType: undefined,
			iconType: 'Folder'
		};
		return nodeInfo;
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
		throw new Error(localize('errDeleteConnectionNode', 'Cannot delete a connection. Only subfolders and files can be deleted.'));
	}

	async getTreeItem(): Promise<vscode.TreeItem> {
		let item = await super.getTreeItem();
		item.contextValue = this._nodeType;
		return item;
	}
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
		item.contextValue = Constants.MssqlClusterItems.File;
		return item;
	}


	getNodeInfo(): sqlops.NodeInfo {
		// TODO improve node type handling so it's not tied to SQL Server types
		let nodeInfo: sqlops.NodeInfo = {
			label: this.getDisplayName(),
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: Constants.MssqlClusterItems.File,
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
			return Constants.MssqlClusterItemsSubType.Spark;
		}

		return undefined;
	}
}

export class ErrorNode extends TreeNode {
	static messageNum: number = 0;

	private _nodePathValue: string;
	constructor(private message: string) {
		super();
	}

	public static create(message: string, parent: TreeNode): ErrorNode {
		let node = new ErrorNode(message);
		node.parent = parent;
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


	getNodeInfo(): sqlops.NodeInfo {
		let nodeInfo: sqlops.NodeInfo = {
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
