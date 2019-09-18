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
import { IconPathHelper, BdcItemType, IconPath } from '../constants';

const localize = nls.loadMessageBundle();

export abstract class ControllerTreeNode extends TreeNode {

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

	public addControllerNode(
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
			controllerNode = new ControllerNode(url, username, password, rememberPassword, undefined, this, this.treeChangeHandler, undefined);
			this.addChild(controllerNode);
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

export class ControllerNode extends ControllerTreeNode {

	constructor(
		private _url: string,
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

	public async getChildren(): Promise<ControllerTreeNode[]> {
		if (this.children && this.children.length > 0) {
			this.clearChildren();
		}

		if (!this._password) {
			vscode.commands.executeCommand('bigDataClusters.command.addController', this);
			return this.children as ControllerTreeNode[];
		}
	}

	public static toIpAndPort(url: string): string {
		if (!url) {
			return;
		}
		return url.trim().replace(/ /g, '').replace(/^.+\:\/\//, '').replace(/:(\d+)$/, ',$1');
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
}

