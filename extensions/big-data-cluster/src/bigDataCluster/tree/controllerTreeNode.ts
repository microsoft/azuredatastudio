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
import { getEndPoints } from '../controller/clusterControllerApi';

const localize = nls.loadMessageBundle();

export abstract class ControllerTreeNode extends TreeNode {

	constructor(
		label: string,
		parent: ControllerTreeNode,
		private _treeChangeHandler: IControllerTreeChangeHandler,
		private _description?: string,
		private _nodeType?: string,
		private _iconPath?: { dark: string, light: string }
	) {
		super(label, parent);
		this._description = this._description || this.label;
	}

	public async getChildren(): Promise<ControllerTreeNode[]> {
		return this.children as ControllerTreeNode[];
	}

	public refresh(): void {
		super.refresh();
		this.treeChangeHandler.notifyNodeChanged(this);
	}

	public getTreeItem(): vscode.TreeItem {
		const item: vscode.TreeItem = {};
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

export class ControllerRootNode extends ControllerTreeNode {

	constructor(treeChangeHandler: IControllerTreeChangeHandler) {
		super('root', undefined, treeChangeHandler, undefined, BdcItemType.controllerRoot);
	}

	public async getChildren(): Promise<ControllerNode[]> {
		return this.children as ControllerNode[];
	}

	public addControllerNode(clusterName: string,
		url: string,
		username: string,
		password: string,
		rememberPassword: boolean
	): void {
		let controllerNode = this.getExistingControllerNode(url, username);
		if (controllerNode) {
			controllerNode.password = password;
			controllerNode.rememberPassword = rememberPassword;
			controllerNode.clearChildren();
		} else {
			controllerNode = new ControllerNode(clusterName, url, username, password, rememberPassword, undefined, this, this.treeChangeHandler, undefined);
			this.addChild(controllerNode);
		}
	}

	public deleteControllerNode(url: string, username: string): ControllerNode {
		if (!url || !username) {
			return undefined;
		}
		const nodes = this.children as ControllerNode[];
		const index = nodes.findIndex(e => e.url === url && e.username === username);
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
		const nodes = this.children as ControllerNode[];
		return nodes.find(e => e.url === url && e.username === username);
	}
}

export class ControllerNode extends ControllerTreeNode {

	private _endPointFolderNode: FolderNode = new FolderNode(localize('textSqlServers', 'SQL Servers'), this, this.treeChangeHandler);
	private _sqlMasterNodePromise: Promise<SqlMasterNode> = undefined;

	constructor(
		private _clusterName: string,
		private _url: string,
		private _username: string,
		private _password: string,
		private _rememberPassword: boolean,
		label: string,
		parent: ControllerTreeNode,
		treeChangeHandler: IControllerTreeChangeHandler,
		description?: string,
	) {
		super(label, parent, treeChangeHandler, description, BdcItemType.controller, IconPath.controllerNode);
		this.label = label;
		this.description = description;
		// If we have a password start preloading the master node data now - otherwise wait until we're given a password
		if (this._password) {
			this.createSqlMasterNode();
		}
	}

	public async getChildren(): Promise<ControllerTreeNode[]> {
		if (this.children && this.children.length > 0) {
			this.clearChildren();
		}

		if (!this._password) {
			vscode.commands.executeCommand('bigDataClusters.command.addController', this);
			return this.children as ControllerTreeNode[];
		}

		this.addChild(this._endPointFolderNode);

		return this.children as ControllerTreeNode[];
	}

	private static toIpAndPort(url: string): string {
		if (!url) {
			return;
		}
		return url.trim().replace(/ /g, '').replace(/^.+\:\/\//, '').replace(/:(\d+)$/, ',$1');
	}

	public getTreeItem(): vscode.TreeItem {
		const item: vscode.TreeItem = super.getTreeItem();
		item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		return item;
	}

	public get clusterName() {
		return this._clusterName;
	}

	public set clusterName(clusterName: string) {
		this._clusterName = clusterName;
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

	public get password() {
		return this._password;
	}

	public set password(pw: string) {
		this._password = pw;
		this.createSqlMasterNode();
	}

	public get rememberPassword() {
		return this._rememberPassword;
	}

	public set rememberPassword(rememberPassword: boolean) {
		this._rememberPassword = rememberPassword;
	}

	public set label(label: string) {
		super.label = label || `controller: ${ControllerNode.toIpAndPort(this._url)} (${this._username})`;
	}

	public get label(): string {
		return super.label;
	}

	public set description(description: string) {
		super.description = description || super.label;
	}

	public get description(): string {
		return super.description;
	}

	/**
	 * Gets the TreeNode for the SQL master Instance. This is async since we need to fetch endpoint data
	 * for the master instance first from the controller.
	 */
	public async getSqlMasterNode(): Promise<SqlMasterNode> {
		if (!this._sqlMasterNodePromise) {
			return this.createSqlMasterNode();
		}
		return this._sqlMasterNodePromise;
	}

	/**
	 * Fetches the endpoint data for the SQL master instance, creates the TreeNode with that data and adds it
	 * to the Endpoints folder node once complete. This is async since we need to fetch endpoint data for the
	 * master instance first from the controller.
	 */
	private async createSqlMasterNode(): Promise<SqlMasterNode> {
		this._sqlMasterNodePromise = new Promise<SqlMasterNode>(async (resolve, reject) => {
			const response = await getEndPoints(this._clusterName, this._url, this._username, this._password, true);
			if (response && response.endPoints) {
				const master = response.endPoints.find(e => e.name && e.name === 'sql-server-master');
				resolve(new SqlMasterNode(master.endpoint, this._endPointFolderNode, undefined, this.treeChangeHandler, master.description));
			}
			reject(new Error(localize('noEndpointsError', "Did not receive valid response when fetching endpoints.")));
		});

		this._sqlMasterNodePromise.then((sqlMasterNode) => {
			this._endPointFolderNode.addChild(sqlMasterNode);
			this._endPointFolderNode.refresh();
		});

		return await this._sqlMasterNodePromise;
	}
}

export class FolderNode extends ControllerTreeNode {
	constructor(
		label: string,
		parent: ControllerTreeNode,
		treeChangeHandler: IControllerTreeChangeHandler
	) {
		super(label, parent, treeChangeHandler, label, BdcItemType.folder, IconPath.folderNode);
	}
}

export class SqlMasterNode extends ControllerTreeNode {
	private static readonly _role: string = 'sql-server-master';
	private _username: string;
	private _password: string;

	constructor(
		private _endPointAddress: string,
		parent: ControllerTreeNode,
		label: string,
		treeChangeHandler: IControllerTreeChangeHandler,
		description?: string,
	) {
		super(label, parent, treeChangeHandler, description, BdcItemType.sqlMaster, IconPath.sqlMasterNode);
		this._username = 'sa';
		this.label = label;
		this.description = description;
	}

	private getControllerPassword(): string {
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
		const item = super.getTreeItem();
		const connectionProfile: azdata.IConnectionProfile = {
			id: this.id,
			connectionName: '',
			serverName: this._endPointAddress,
			databaseName: '',
			userName: this._username,
			password: this.getControllerPassword(),
			authenticationType: 'SqlLogin',
			savePassword: false,
			groupFullName: '',
			groupId: '',
			providerName: 'MSSQL',
			saveProfile: false,
			options: {}
		};
		return Object.assign(item, {
			payload: connectionProfile,
			childProvider: 'MSSQL',
			type: 'Server'
		});
	}

	public get role() {
		return SqlMasterNode._role;
	}

	public get endPointAddress() {
		return this._endPointAddress;
	}

	public set endPointAddress(endPointAddress: string) {
		this._endPointAddress = endPointAddress;
	}

	public set label(label: string) {
		super.label = label || `master: ${this._endPointAddress} (${this._username})`;
	}

	public get label(): string {
		return super.label;
	}

	public set description(description: string) {
		super.description = description || super.label;
	}

	public get description(): string {
		return super.description;
	}

	public get username(): string {
		return this._username;
	}
}
