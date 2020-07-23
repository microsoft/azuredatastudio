/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { IControllerTreeChangeHandler } from './controllerTreeChangeHandler';
import { TreeNode } from './treeNode';
import { IconPathHelper, BdcItemType, IconPath } from '../constants';
import { AuthType } from 'bdc';

abstract class ControllerTreeNode extends TreeNode {

	constructor(
		label: string,
		parent: ControllerTreeNode,
		private _treeChangeHandler: IControllerTreeChangeHandler,
		private _description?: string,
		private _nodeType?: string,
		private _iconPath?: IconPath
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
		let item: vscode.TreeItem = {};
		item.id = this.id;
		item.label = this.label;
		item.collapsibleState = vscode.TreeItemCollapsibleState.None;
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

	public set iconPath(iconPath: IconPath) {
		this._iconPath = iconPath;
	}

	public get iconPath(): IconPath {
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

	/**
	 * Creates or updates a node in the tree with the specified connection information
	 * @param url The URL for the BDC management endpoint
	 * @param auth The type of auth to use
	 * @param username The username (if basic auth)
	 * @param password The password (if basic auth)
	 * @param rememberPassword Whether to store the password in the password store when saving
	 */
	public addOrUpdateControllerNode(
		url: string,
		auth: AuthType,
		username: string,
		password: string,
		rememberPassword: boolean
	): void {
		let controllerNode = this.getExistingControllerNode(url, auth, username);
		if (controllerNode) {
			controllerNode.password = password;
			controllerNode.rememberPassword = rememberPassword;
			controllerNode.clearChildren();
		} else {
			controllerNode = new ControllerNode(url, auth, username, password, rememberPassword, undefined, this, this.treeChangeHandler, undefined);
			this.addChild(controllerNode);
		}
	}

	public removeControllerNode(url: string, auth: AuthType, username: string): ControllerNode[] | undefined {
		if (!url || (auth === 'basic' && !username)) {
			return undefined;
		}
		let nodes = this.children as ControllerNode[];
		let index = nodes.findIndex(e => isControllerMatch(e, url, auth, username));
		let deleted: ControllerNode[] | undefined;
		if (index >= 0) {
			deleted = nodes.splice(index, 1);
		}
		return deleted;
	}

	private getExistingControllerNode(url: string, auth: AuthType, username: string): ControllerNode | undefined {
		if (!url || !username) {
			return undefined;
		}
		let nodes = this.children as ControllerNode[];
		return nodes.find(e => isControllerMatch(e, url, auth, username));
	}
}

export class ControllerNode extends ControllerTreeNode {

	constructor(
		private _url: string,
		private _auth: AuthType,
		private _username: string,
		private _password: string,
		private _rememberPassword: boolean,
		label: string,
		parent: ControllerTreeNode,
		treeChangeHandler: IControllerTreeChangeHandler,
		description?: string,
	) {
		super(label, parent, treeChangeHandler, description, BdcItemType.controller, IconPathHelper.controllerNode);
		this.label = label;
		this.description = description;
	}

	public async getChildren(): Promise<ControllerTreeNode[] | undefined> {
		if (this.children && this.children.length > 0) {
			this.clearChildren();
		}

		if (!this._password) {
			vscode.commands.executeCommand('bigDataClusters.command.connectController', this);
			return this.children as ControllerTreeNode[];
		}
		return undefined;
	}

	public static toIpAndPort(url: string): string | undefined {
		if (!url) {
			return undefined;
		}
		return url.trim().replace(/ /g, '').replace(/^.+\:\/\//, '');
	}

	public get url(): string {
		return this._url;
	}


	public get auth(): AuthType {
		return this._auth;
	}


	public get username(): string {
		return this._username;
	}

	public get password(): string {
		return this._password;
	}

	public set password(pw: string) {
		this._password = pw;
	}

	public set label(label: string) {
		super.label = label || this.generateLabel();
	}

	public get rememberPassword() {
		return this._rememberPassword;
	}

	public set rememberPassword(rememberPassword: boolean) {
		this._rememberPassword = rememberPassword;
	}

	private generateLabel(): string {
		let label = `controller: ${ControllerNode.toIpAndPort(this._url)}`;
		if (this._auth === 'basic') {
			label += ` (${this._username})`;
		}
		return label;
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
}

function isControllerMatch(node: ControllerNode, url: string, auth: string, username: string): unknown {
	return node.url === url && node.auth === auth && node.username === username;
}
