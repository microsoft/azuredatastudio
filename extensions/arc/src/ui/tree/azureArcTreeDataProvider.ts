/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo } from 'arc';
import * as vscode from 'vscode';
import { ControllerModel } from '../../models/controllerModel';
import { ControllerTreeNode } from './controllerTreeNode';
import { TreeNode } from './treeNode';

const mementoToken = 'arcDataControllers.v2';

/**
 * The TreeDataProvider for the Azure Arc view, which displays a list of registered
 * controllers and the resources under them.
 */
export class AzureArcTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {

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

	public async addOrUpdateController(model: ControllerModel, refreshTree = true): Promise<void> {
		const controllerNode = this.getControllerNode(model);
		if (controllerNode) {
			controllerNode.model.info = model.info;
		} else {
			this._controllerNodes.push(new ControllerTreeNode(model, this._context, this));
		}
		if (refreshTree) {
			this._onDidChangeTreeData.fire(undefined);
		}
		await this.saveControllers();
	}

	public getControllerNode(model: ControllerModel): ControllerTreeNode | undefined {
		return this._controllerNodes.find(node => model.info.id === node.model.info.id);
	}

	public async removeController(controllerNode: ControllerTreeNode): Promise<void> {
		this._controllerNodes = this._controllerNodes.filter(node => node !== controllerNode);
		this._onDidChangeTreeData.fire(undefined);
		await this.saveControllers();
	}

	/**
	 * Refreshes the specified node, or the entire tree if node is undefined
	 * @param node The node to refresh, or undefined for the whole tree
	 */
	public refreshNode(node: TreeNode | undefined): void {
		this._onDidChangeTreeData.fire(node);
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
	 * @param name The name of the resource
	 */
	public async openResourceDashboard(controllerModel: ControllerModel, resourceType: string, name: string): Promise<void> {
		const controllerNode = this._controllerNodes.find(n => n.model === controllerModel);
		if (controllerNode) {
			const resourceNode = controllerNode.getResourceNode(resourceType, name);
			if (resourceNode) {
				await resourceNode.openDashboard();
			} else {
				const errMsg = `Couldn't find resource node for ${name} (${resourceType})`;
				console.log(errMsg);
				throw new Error(errMsg);
			}
		} else {
			const errMsg = 'Couldn\'t find controller node for opening dashboard';
			console.log(errMsg);
			throw new Error(errMsg);
		}
	}
}
