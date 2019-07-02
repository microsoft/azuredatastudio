/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { TreeNode } from './treeNode';
import { IControllerTreeChangeHandler } from './controllerTreeChangeHandler';
import { AddControllerNode } from './addControllerTreeNode';
import { ControllerRootNode, ControllerNode } from './controllerTreeNode';
import { IEndPoint } from '../controller/clusterController';

const ConfigNamespace = 'clusterControllers';
const CredentialNamespace = 'clusterControllerCredentials';

export class ControllerTreeDataProvider implements vscode.TreeDataProvider<TreeNode>, IControllerTreeChangeHandler {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode> = new vscode.EventEmitter<TreeNode>();
	public readonly onDidChangeTreeData: vscode.Event<TreeNode> = this._onDidChangeTreeData.event;
	private root: ControllerRootNode;
	private credentialProvider: azdata.CredentialProvider;

	constructor() {
		this.root = new ControllerRootNode({ treeChangeHandler: this });
		this.loadSavedControllers();
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			return element.getChildren();
		}

		if (this.root.hasChildren) {
			return this.root.getChildren();
		} else {
			return [new AddControllerNode()];
		}
	}

	public getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.getTreeItem();
	}

	public addController(
		url: string,
		username: string,
		password: string,
		rememberPassword: boolean,
		masterInstance?: IEndPoint
	): void {
		this.root.addControllerNode(url, username, password, rememberPassword, masterInstance);
		this.notifyNodeChanged();
	}

	public deleteController(url: string, username: string): ControllerNode {
		let deleted = this.root.deleteControllerNode(url, username);
		if (deleted) {
			this.notifyNodeChanged();
		}
		return deleted;
	}

	public notifyNodeChanged(node?: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	public async loadSavedControllers(): Promise<void> {
		let config = vscode.workspace.getConfiguration(ConfigNamespace);
		if (config && config.controllers) {
			let controllers = config.controllers;
			this.root.clearChildren();
			for (let c of controllers) {
				let password = undefined;
				if (c.rememberPassword) {
					password = await this.getPassword(c.url, c.username);
				}
				this.root.addChild(new ControllerNode({
					url: c.url,
					username: c.username,
					password: password,
					rememberPassword: c.rememberPassword,
					parent: this.root,
					treeChangeHandler: this
				}));
			}
			this.notifyNodeChanged();
		}
	}

	public async saveControllers(): Promise<void> {
		let controllers = this.root.children.map(e => {
			let controller = e as ControllerNode;
			return {
				url: controller.url,
				username: controller.username,
				password: controller.password,
				rememberPassword: !!controller.rememberPassword
			};
		});

		let controllersWithoutPassword = controllers.map(e => {
			return {
				url: e.url,
				username: e.username,
				rememberPassword: e.rememberPassword
			};
		});

		try {
			await vscode.workspace.getConfiguration(ConfigNamespace).update('controllers', controllersWithoutPassword, true);
		} catch (error) {
			vscode.window.showErrorMessage(error.message);
		}

		for (let e of controllers) {
			await this.savePassword(e.url, e.username, e.password);
		}
	}

	private async savePassword(url: string, username: string, password: string): Promise<boolean> {
		let provider = await this.getCredentialProvider();
		let id = this.createId(url, username);
		let result = await provider.saveCredential(id, password);
		return result;
	}

	private async getPassword(url: string, username: string): Promise<string> {
		let provider = await this.getCredentialProvider();
		let id = this.createId(url, username);
		let credential = await provider.readCredential(id);
		return credential ? credential.password : undefined;
	}

	private async getCredentialProvider(): Promise<azdata.CredentialProvider> {
		if (!this.credentialProvider) {
			this.credentialProvider = await azdata.credentials.getProvider(CredentialNamespace);
		}
		return this.credentialProvider;
	}

	private createId(url: string, username: string): string {
		return `${url}::${username}`;
	}
}
