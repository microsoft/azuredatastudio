/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { TreeNode } from './treeNode';
import { IControllerTreeChangeHandler } from './controllerTreeChangeHandler';
import { ControllerRootNode, ControllerNode } from './controllerTreeNode';
import { showErrorMessage } from '../utils';
import { AuthType } from 'bdc';

const localize = nls.loadMessageBundle();

const CredentialNamespace = 'clusterControllerCredentials';

interface IControllerInfoSlim {
	url: string;
	auth: AuthType;
	username: string;
	password?: string;
	rememberPassword: boolean;
}

export class ControllerTreeDataProvider implements vscode.TreeDataProvider<TreeNode>, IControllerTreeChangeHandler {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode> = new vscode.EventEmitter<TreeNode>();
	public readonly onDidChangeTreeData: vscode.Event<TreeNode> = this._onDidChangeTreeData.event;
	private root: ControllerRootNode;
	private credentialProvider: azdata.CredentialProvider;
	private initialized: boolean = false;

	constructor(private memento: vscode.Memento) {
		this.root = new ControllerRootNode(this);
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			return element.getChildren();
		}

		if (!this.initialized) {
			this.loadSavedControllers().catch(err => { vscode.window.showErrorMessage(localize('bdc.controllerTreeDataProvider.error', "Unexpected error loading saved controllers: {0}", err)); });
		} else {
			// We set the context here since VS Code takes a bit of time to process the _onDidChangeTreeData
			// and so if we set it as soon as we finished loading the controllers it would briefly flash
			// the "connect to controller" welcome view
			await vscode.commands.executeCommand('setContext', 'bdc.loaded', true);
		}

		return this.root.getChildren();
	}

	public getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.getTreeItem();
	}

	public notifyNodeChanged(node?: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	/**
	 * Creates or updates a node in the tree with the specified connection information
	 * @param url The URL for the BDC management endpoint
	 * @param auth The type of auth to use
	 * @param username The username (if basic auth)
	 * @param password The password (if basic auth)
	 * @param rememberPassword Whether to store the password in the password store when saving
	 */
	public addOrUpdateController(
		url: string,
		auth: AuthType,
		username: string,
		password: string,
		rememberPassword: boolean
	): void {
		this.removeNonControllerNodes();
		this.root.addOrUpdateControllerNode(url, auth, username, password, rememberPassword);
		this.notifyNodeChanged();
	}

	public removeController(url: string, auth: AuthType, username: string): ControllerNode[] {
		let removed = this.root.removeControllerNode(url, auth, username);
		if (removed) {
			this.notifyNodeChanged();
		}
		return removed;
	}

	private removeNonControllerNodes(): void {
		this.removeDefectiveControllerNodes(this.root.children);
	}

	private removeDefectiveControllerNodes(nodes: TreeNode[]): void {
		if (nodes.length > 0) {
			for (let i = 0; i < nodes.length; ++i) {
				if (nodes[i] instanceof ControllerNode) {
					let controller = nodes[i] as ControllerNode;
					if (!controller.url || !controller.id) {
						nodes.splice(i--, 1);
					}
				}
			}
		}
	}

	private async loadSavedControllers(): Promise<void> {
		// Optimistically set to true so we don't double-load the tree
		this.initialized = true;
		try {
			let controllers: IControllerInfoSlim[] = this.memento.get('controllers');
			let treeNodes: TreeNode[] = [];
			if (controllers) {
				for (const c of controllers) {
					let password = undefined;
					if (c.rememberPassword) {
						password = await this.getPassword(c.url, c.username);
					}
					if (!c.auth) {
						// Added before we had added authentication
						c.auth = 'basic';
					}
					treeNodes.push(new ControllerNode(
						c.url, c.auth, c.username, password, c.rememberPassword,
						undefined, this.root, this, undefined
					));
				}
				this.removeDefectiveControllerNodes(treeNodes);
			}

			this.root.clearChildren();
			treeNodes.forEach(node => this.root.addChild(node));
			this.notifyNodeChanged();
		} catch (err) {
			// Reset so we can try again if the tree refreshes
			this.initialized = false;
			throw err;
		}

	}

	public async saveControllers(): Promise<void> {
		const controllers = this.root.children.map((e): IControllerInfoSlim => {
			const controller = e as ControllerNode;
			return {
				url: controller.url,
				auth: controller.auth,
				username: controller.username,
				password: controller.password,
				rememberPassword: controller.rememberPassword
			};
		});

		const controllersWithoutPassword = controllers.map((e): IControllerInfoSlim => {
			return {
				url: e.url,
				auth: e.auth,
				username: e.username,
				rememberPassword: e.rememberPassword
			};
		});

		try {
			await this.memento.update('controllers', controllersWithoutPassword);
		} catch (error) {
			showErrorMessage(error);
		}

		for (const e of controllers) {
			if (e.rememberPassword) {
				await this.savePassword(e.url, e.username, e.password);
			} else {
				await this.deletePassword(e.url, e.username);
			}
		}
	}

	private async savePassword(url: string, username: string, password: string): Promise<boolean> {
		let provider = await this.getCredentialProvider();
		let id = this.createId(url, username);
		let result = await provider.saveCredential(id, password);
		return result;
	}

	private async deletePassword(url: string, username: string): Promise<boolean> {
		let provider = await this.getCredentialProvider();
		let id = this.createId(url, username);
		let result = await provider.deleteCredential(id);
		return result;
	}

	private async getPassword(url: string, username: string): Promise<string | undefined> {
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
