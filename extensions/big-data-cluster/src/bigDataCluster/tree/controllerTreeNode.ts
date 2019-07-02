/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { IControllerTreeChangeHandler } from './controllerTreeChangeHandler';
import { TreeNode } from './treeNode';
import { IconPath, BdcItemType } from '../constants';
import { ClusterController, IEndPoint, IControllerError } from '../controller/clusterController';

const localize = nls.loadMessageBundle();

export type ControllerTreeNodeArg = {
	label: string;
	treeChangeHandler: IControllerTreeChangeHandler;
	parent?: ControllerTreeNode;
	description?: string;
	nodeType?: string;
	iconPath?: { dark: string, light: string };
};

export abstract class ControllerTreeNode extends TreeNode {
	private _description: string;
	private _nodeType: string;
	private _iconPath: { dark: string, light: string };
	private _treeChangeHandler: IControllerTreeChangeHandler;

	constructor(arg?: ControllerTreeNodeArg) {
		super(arg);
		this._treeChangeHandler = arg.treeChangeHandler;
		this._description = arg.description || arg.label;
		this._nodeType = arg.nodeType;
		this._iconPath = arg.iconPath;
	}

	public async getChildren(): Promise<ControllerTreeNode[]> {
		return this.children as ControllerTreeNode[];
	}

	public refresh(): void {
		super.refresh();
		this.treeChangeHandler.notifyNodeChanged(this);
	}

	public getTreeItem(): vscode.TreeItem {
		let item: vscode.TreeItem = {};
		item.id = this.id;
		item.label = this.label;
		item.collapsibleState = this.isLeaf ?
			vscode.TreeItemCollapsibleState.None :
			vscode.TreeItemCollapsibleState.Collapsed;
		item.iconPath = this._iconPath;
		item.contextValue = this._nodeType;
		item.tooltip = this._description;
		item.iconPath = this._iconPath;
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this.label,
			isLeaf: this.isLeaf,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.nodePath,
			nodeStatus: undefined,
			nodeType: this._nodeType,
			iconType: this._nodeType,
			nodeSubType: undefined
		};
	}

	public get description(): string {
		return this._description;
	}

	public set description(description: string) {
		this._description = description;
	}

	public get nodeType(): string {
		return this._nodeType;
	}

	public set nodeType(nodeType: string) {
		this._nodeType = nodeType;
	}

	public set iconPath(iconPath: { dark: string, light: string }) {
		this._iconPath = iconPath;
	}

	public get iconPath(): { dark: string, light: string } {
		return this._iconPath;
	}

	public set treeChangeHandler(treeChangeHandler: IControllerTreeChangeHandler) {
		this._treeChangeHandler = treeChangeHandler;
	}

	public get treeChangeHandler(): IControllerTreeChangeHandler {
		return this._treeChangeHandler;
	}
}

export type ControllerRootNodeArg = {
	treeChangeHandler: IControllerTreeChangeHandler;
};

export class ControllerRootNode extends ControllerTreeNode {

	constructor(arg?: ControllerRootNodeArg) {
		super(Object.assign({
			label: 'root',
			nodeType: BdcItemType.controllerRoot,
		}, arg));
	}

	public async getChildren(): Promise<ControllerNode[]> {
		return this.children as ControllerNode[];
	}

	public addControllerNode(url: string, username: string, password: string, rememberPassword: boolean, masterInstance?: IEndPoint): void {
		let controllerNode = this.getExistingControllerNode(url, username);
		if (controllerNode) {
			controllerNode.password = password;
			controllerNode.rememberPassword = rememberPassword;
			controllerNode.clearChildren();
		} else {
			controllerNode = new ControllerNode({ url, username, password, rememberPassword, parent: this, treeChangeHandler: this.treeChangeHandler });
			this.addChild(controllerNode);
		}

		if (masterInstance) {
			controllerNode.addSqlMasterNode(masterInstance.endpoint, masterInstance.description);
		}
	}

	public deleteControllerNode(url: string, username: string): ControllerNode {
		if (!url || !username) {
			return undefined;
		}
		let nodes = this.children as ControllerNode[];
		let index = nodes.findIndex(e => e.url === url && e.username === username);
		let deleted = undefined;
		if (index >= 0) {
			deleted = nodes.splice(index, 1);
		}
		return deleted;
	}

	private getExistingControllerNode(url: string, username: string): ControllerNode {
		if (!url || !username) {
			return undefined;
		}
		let nodes = this.children as ControllerNode[];
		return nodes.find(e => e.url === url && e.username === username);
	}
}

export type ControllerNodeArg = {
	url: string,
	username: string,
	password: string,
	parent: ControllerTreeNode,
	treeChangeHandler: IControllerTreeChangeHandler,
	label?: string,
	description?: string,
	rememberPassword?: boolean
};

export class ControllerNode extends ControllerTreeNode {
	private _url: string;
	private _username: string;
	private _password: string;
	private _rememberPassword: boolean;

	constructor(arg?: ControllerNodeArg) {
		super(Object.assign({
			label: undefined,
			nodeType: BdcItemType.controller,
			iconPath: IconPath.controllerNode
		}, arg));

		let address = ControllerNode.toIpAndPort(arg.url);
		this.label = arg.label || `controller: ${address} (${arg.username})`;
		this.description = arg.description || this.label;
		this._url = arg.url;
		this._username = arg.username;
		this._password = arg.password;
		this._rememberPassword = !!arg.rememberPassword;
	}


	public async getChildren(): Promise<ControllerTreeNode[]> {
		if (this.children && this.children.length > 0) {
			this.clearChildren();
		}

		if (!this._password) {
			vscode.commands.executeCommand('bigDataClusters.command.addController', this);
			return this.children as ControllerTreeNode[];
		}

		try {
			let clusterController = new ClusterController();
			let response = await clusterController.getEndPoints(this._url, this._username, this._password, true);
			if (response && response.endPoints) {
				let master = response.endPoints.find(e => e.name && e.name === 'sql-server-master');
				this.addSqlMasterNode(master.endpoint, master.description);
			}
			return this.children as ControllerTreeNode[];
		} catch (error) {
			let e = error as IControllerError;
			vscode.window.showErrorMessage(e.message);
			return this.children as ControllerTreeNode[];
		}
	}

	private static toIpAndPort(url: string): string {
		if (!url) {
			return;
		}
		return url.trim().replace(/ /g, '').replace(/^.+\:\/\//, '').replace(/:(\d+)$/, ',$1');
	}

	public addSqlMasterNode(endPointAddress: string, description: string): void {
		let epFolder = this.getEndPointFolderNode();
		epFolder.addChild(new SqlMasterNode({ endPointAddress, parent: epFolder, treeChangeHandler: this.treeChangeHandler, description }));
	}

	private getEndPointFolderNode(): FolderNode {
		let label = localize('textSqlServers', 'SQL Servers');
		let epFolderNode = this.children.find(e => e instanceof FolderNode && e.label === label);
		if (!epFolderNode) {
			epFolderNode = new FolderNode({ label, parent: this, treeChangeHandler: this.treeChangeHandler });
			this.addChild(epFolderNode);
		}
		return epFolderNode as FolderNode;
	}

	public getTreeItem(): vscode.TreeItem {
		let item: vscode.TreeItem = super.getTreeItem();
		item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		return item;
	}

	public get url() {
		return this._url;
	}

	public set url(url: string) {
		this._url = url;
	}

	public get username() {
		return this._username;
	}

	public set username(username: string) {
		this._username = username;
	}

	public get password() {
		return this._password;
	}

	public set password(pw: string) {
		this._password = pw;
	}

	public get rememberPassword() {
		return this._rememberPassword;
	}

	public set rememberPassword(rememberPassword: boolean) {
		this._rememberPassword = rememberPassword;
	}
}

export type FolderNodeArg = {
	label: string;
	parent: ControllerTreeNode;
	treeChangeHandler: IControllerTreeChangeHandler;
};

export class FolderNode extends ControllerTreeNode {
	constructor(arg?: FolderNodeArg) {
		super(Object.assign({
			description: arg.label,
			nodeType: BdcItemType.folder,
			iconPath: IconPath.folderNode
		}, arg));
	}
}

export type SqlMasterNodeArg = {
	endPointAddress: string,
	parent: ControllerTreeNode,
	treeChangeHandler: IControllerTreeChangeHandler,
	label?: string,
	description?: string,
};

export class SqlMasterNode extends ControllerTreeNode {
	private _role: string;
	private _endPointAddress: string;
	private _username: string;
	private _password: string;

	constructor(arg?: SqlMasterNodeArg) {
		super(Object.assign({
			label: undefined,
			nodeType: BdcItemType.sqlMaster,
			iconPath: IconPath.sqlMasterNode
		}, arg));

		this._endPointAddress = arg.endPointAddress;
		this._username = 'sa';
		this._role = 'sql-server-master';
		this.label = arg.label || `master: ${this._endPointAddress} (${this._username})`;
		this.description = arg.description || this.label;
	}

	private getPassword(): string {
		if (!this._password) {
			let current: TreeNode = this;
			while (current && !(current instanceof ControllerNode)) {
				current = current.parent;
			}
			this._password = current && current instanceof ControllerNode ? current.password : undefined;
		}
		return this._password;
	}

	public getTreeItem(): vscode.TreeItem {
		let item = super.getTreeItem();
		let connectionProfile: azdata.IConnectionProfile = {
			id: this.id,
			connectionName: this.id,
			serverName: this._endPointAddress,
			databaseName: '',
			userName: this._username,
			password: this.getPassword(),
			authenticationType: 'SqlLogin',
			savePassword: false,
			groupFullName: '',
			groupId: '',
			providerName: 'MSSQL',
			saveProfile: false,
			options: {}
		};
		return Object.assign(item, { payload: connectionProfile, childProvider: 'MSSQL' });
	}

	public get role() {
		return this._role;
	}

	public set role(role: string) {
		this._role = role;
	}

	public get endPointAddress() {
		return this._endPointAddress;
	}

	public set endPointAddress(endPointAddress: string) {
		this._endPointAddress = endPointAddress;
	}
}
