/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ControllerTreeNode } from './controllerTreeNode';
import { TreeNode } from './treeNode';
import { ControllerModel, ControllerInfo } from '../../models/controllerModel';

const mementoToken = 'arcControllers';

/**
 * The TreeDataProvider for the Azure Arc view, which displays a list of registered
 * controllers and the resources under them.
 */
export class AzureArcTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {

	private _credentialsProvider = azdata.credentials.getProvider('arcControllerPasswords');
	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

	private _loading: boolean = true;

	private _controllerNodes: ControllerTreeNode[] = [];

	constructor(private _context: vscode.ExtensionContext) {
		this.loadSavedControllers().catch(err => console.log(`Error loading saved Arc controllers ${err}`));
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (this._loading) {
			return [];
		}

		// We set the context here since VS Code takes a bit of time to process the _onDidChangeTreeData
		// and so if we set it as soon as we finished loading the controllers it would briefly flash
		// the "connect to controller" welcome view
		await vscode.commands.executeCommand('setContext', 'arc.loaded', true);

		if (element) {
			return element.getChildren();
		} else {
			return this._controllerNodes;
		}
	}

	public getTreeItem(element: TreeNode): TreeNode | Thenable<TreeNode> {
		return element;
	}

	public async addOrUpdateController(model: ControllerModel, password: string, refreshTree = true): Promise<void> {
		const controllerNode = this._controllerNodes.find(node => model.equals(node.model));
		if (controllerNode) {
			controllerNode.model.info = model.info;
		} else {
			this._controllerNodes.push(new ControllerTreeNode(model, this._context, this));
		}
		await this.updatePassword(model, password);
		if (refreshTree) {
			this._onDidChangeTreeData.fire(undefined);
		}
		await this.saveControllers();
	}

	public async removeController(controllerNode: ControllerTreeNode): Promise<void> {
		this._controllerNodes = this._controllerNodes.filter(node => node !== controllerNode);
		this._onDidChangeTreeData.fire(undefined);
		await this.saveControllers();
	}

	public async getPassword(info: ControllerInfo): Promise<string> {
		const provider = await this._credentialsProvider;
		const credential = await provider.readCredential(getCredentialId(info));
		return credential.password;
	}

	/**
	 * Refreshes the specified node, or the entire tree if node is undefined
	 * @param node The node to refresh, or undefined for the whole tree
	 */
	public refreshNode(node: TreeNode | undefined): void {
		this._onDidChangeTreeData.fire(node);
	}

	private async updatePassword(model: ControllerModel, password: string): Promise<void> {
		const provider = await this._credentialsProvider;
		if (model.info.rememberPassword) {
			provider.saveCredential(getCredentialId(model.info), password);
		} else {
			provider.deleteCredential(getCredentialId(model.info));
		}
	}

	private async loadSavedControllers(): Promise<void> {
		try {
			const controllerMementos: ControllerInfo[] = this._context.globalState.get(mementoToken) || [];
			this._controllerNodes = controllerMementos.map(memento => {
				const controllerModel = new ControllerModel(this, memento);
				return new ControllerTreeNode(controllerModel, this._context, this);
			});
		} finally {
			this._loading = false;
			this._onDidChangeTreeData.fire(undefined);
		}
	}

	public async saveControllers(): Promise<void> {
		const controllerInfo = this._controllerNodes.map(node => node.model.info);
		await this._context.globalState.update(mementoToken, controllerInfo);
	}

	/**
	 * Opens the dashboard for the specified resource
	 * @param controllerModel The model for the controller containing the resource we want to open the dashboard for
	 * @param resourceType The resourceType for the resource
	 * @param namespace The namespace of the resource
	 * @param name The name of the resource
	 */
	public async openResourceDashboard(controllerModel: ControllerModel, resourceType: string, namespace: string, name: string): Promise<void> {
		const controllerNode = this._controllerNodes.find(n => n.model === controllerModel);
		if (controllerNode) {
			const resourceNode = controllerNode.getResourceNode(resourceType, namespace, name);
			if (resourceNode) {

			} else {
				console.log(`Couldn't find resource node for ${namespace}.${name} (${resourceType})`);
			}
			await resourceNode?.openDashboard();
		} else {
			console.log('Couldn\'t find controller node for opening dashboard');
		}
	}
}

function getCredentialId(info: ControllerInfo): string {
	return `${info.url}::${info.username}`;
}
