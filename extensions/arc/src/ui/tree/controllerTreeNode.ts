/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MiaaResourceInfo, PGResourceInfo, ResourceInfo, ResourceType } from 'arc';
import * as vscode from 'vscode';
import { UserCancelledError } from '../../common/api';
import * as loc from '../../localizedConstants';
import { ControllerModel, Registration } from '../../models/controllerModel';
import { MiaaModel } from '../../models/miaaModel';
import { PostgresModel } from '../../models/postgresModel';
import { ResourceModel } from '../../models/resourceModel';
import { ControllerDashboard } from '../dashboards/controller/controllerDashboard';
import { AzureArcTreeDataProvider } from './azureArcTreeDataProvider';
import { MiaaTreeNode } from './miaaTreeNode';
import { NoInstancesTreeNode } from './noInstancesTreeNode';
import { PostgresTreeNode } from './postgresTreeNode';
import { RefreshTreeNode } from './refreshTreeNode';
import { ResourceTreeNode } from './resourceTreeNode';
import { TreeNode } from './treeNode';

/**
 * The TreeNode for displaying an Azure Arc Controller
 */
export class ControllerTreeNode extends TreeNode {

	private _children: ResourceTreeNode<ResourceModel>[] = [];

	constructor(public model: ControllerModel, private _context: vscode.ExtensionContext, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(model.label, vscode.TreeItemCollapsibleState.Collapsed, ResourceType.dataControllers);
		model.onInfoUpdated(_ => {
			this.label = model.label;
		});
		model.onRegistrationsUpdated(registrations => {
			this.updateChildren(registrations);
		});
	}

	public override async getChildren(): Promise<TreeNode[]> {
		try {
			await this.model.refresh(false, this.model.info.namespace);
			this.updateChildren(this.model.registrations);
		} catch (err) {
			vscode.window.showErrorMessage(loc.errorConnectingToController(err));
			try {
				await this.model.refresh(false, this.model.info.namespace);
				this.updateChildren(this.model.registrations);
			} catch (err) {
				if (!(err instanceof UserCancelledError)) {
					vscode.window.showErrorMessage(loc.errorConnectingToController(err));
				}
				// Couldn't get the children and TreeView doesn't have a way to collapse a node
				// in a way that will refetch its children when expanded again so instead we
				// display a temporary node that will prompt the user to re-enter credentials
				return [new RefreshTreeNode(this)];
			}
		}

		return this._children.length > 0 ? this._children : [new NoInstancesTreeNode()];
	}

	public override async openDashboard(): Promise<void> {
		const controllerDashboard = new ControllerDashboard(this.model);
		await controllerDashboard.showDashboard();
	}

	/**
	 * Finds and returns the ResourceTreeNode specified if it exists, otherwise undefined
	 * @param resourceType The resourceType of the node
	 * @param name The name of the node
	 */
	public getResourceNode(resourceType: string, name: string): ResourceTreeNode<ResourceModel> | undefined {
		return this._children.find(c =>
			c.model?.info.resourceType === resourceType &&
			c.model.info.name === name);
	}

	private updateChildren(registrations: Registration[]): void {
		const newChildren: ResourceTreeNode<ResourceModel>[] = [];
		registrations.forEach(registration => {
			if (!registration.instanceName) {
				console.warn('Registration is missing required name value, skipping');
				return;
			}

			const resourceInfo: ResourceInfo = {
				name: registration.instanceName,
				resourceType: registration.instanceType ?? ''
			};

			let node = this._children.find(n =>
				n.model?.info?.name === resourceInfo.name &&
				n.model?.info?.resourceType === resourceInfo.resourceType);

			// If we don't have this child already then create a new node for it
			if (!node) {
				// If we had a stored connectionId copy that over
				resourceInfo.connectionId = this.model.info.resources.find(info =>
					info.name === resourceInfo.name &&
					info.resourceType === resourceInfo.resourceType)?.connectionId;

				switch (registration.instanceType) {
					case ResourceType.postgresInstances:
						// Fill in the username too if we already have it
						(resourceInfo as PGResourceInfo).userName = (this.model.info.resources.find(info =>
							info.name === resourceInfo.name &&
							info.resourceType === resourceInfo.resourceType) as PGResourceInfo)?.userName;
						const postgresModel = new PostgresModel(this.model, resourceInfo, registration, this._treeDataProvider);
						node = new PostgresTreeNode(postgresModel, this.model, this._context);
						break;
					case ResourceType.sqlManagedInstances:
						// Fill in the username too if we already have it
						(resourceInfo as MiaaResourceInfo).userName = (this.model.info.resources.find(info =>
							info.name === resourceInfo.name &&
							info.resourceType === resourceInfo.resourceType) as MiaaResourceInfo)?.userName;
						const miaaModel = new MiaaModel(this.model, resourceInfo, registration, this._treeDataProvider);
						node = new MiaaTreeNode(miaaModel, this.model);
						break;
				}
			}
			if (node) {
				newChildren.push(node);
			}
		});
		this._children = newChildren;

		// Update our model info too
		this.model.info.resources = <ResourceInfo[]>this._children.map(c => c.model?.info).filter(c => c);
		this._treeDataProvider.saveControllers();
	}
}
