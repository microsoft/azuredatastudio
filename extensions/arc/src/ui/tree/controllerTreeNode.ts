/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TreeNode } from './treeNode';
import { MiaaTreeNode } from './miaaTreeNode';
import { ResourceType } from '../../constants';
import { PostgresTreeNode } from './postgresTreeNode';
import { ControllerModel, Registration, ResourceInfo } from '../../models/controllerModel';
import { ControllerDashboard } from '../dashboards/controller/controllerDashboard';
import { PostgresModel } from '../../models/postgresModel';
import { parseInstanceName, UserCancelledError } from '../../common/utils';
import { MiaaModel } from '../../models/miaaModel';
import { Deferred } from '../../common/promise';
import { RefreshTreeNode } from './refreshTreeNode';
import { ResourceTreeNode } from './resourceTreeNode';
import { AzureArcTreeDataProvider } from './azureArcTreeDataProvider';
import * as loc from '../../localizedConstants';

/**
 * The TreeNode for displaying an Azure Arc Controller
 */
export class ControllerTreeNode extends TreeNode {

	private _children: ResourceTreeNode[] = [];
	private _childrenRefreshPromise = new Deferred();

	constructor(public model: ControllerModel, private _context: vscode.ExtensionContext, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(model.label, vscode.TreeItemCollapsibleState.Collapsed, ResourceType.dataControllers);
		model.onRegistrationsUpdated(registrations => this.refreshChildren(registrations));
	}

	public async getChildren(): Promise<TreeNode[]> {
		// First reset our deferred promise so we're sure we'll get the refreshed children
		this._childrenRefreshPromise = new Deferred();
		try {
			await this.model.refresh(false);
			await this._childrenRefreshPromise.promise;
		} catch (err) {
			vscode.window.showErrorMessage(loc.errorConnectingToController(err));
			try {
				await this.model.refresh(false, true);
				await this._childrenRefreshPromise.promise;
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

		return this._children;
	}

	public async openDashboard(): Promise<void> {
		const controllerDashboard = new ControllerDashboard(this.model);
		await controllerDashboard.showDashboard();
	}

	/**
	 * Finds and returns the ResourceTreeNode specified if it exists, otherwise undefined
	 * @param resourceType The resourceType of the node
	 * @param namespace The namespace of the node
	 * @param name The name of the node
	 */
	public getResourceNode(resourceType: string, namespace: string, name: string): ResourceTreeNode | undefined {
		return this._children.find(c =>
			c.model?.info.resourceType === resourceType &&
			c.model?.info.namespace === namespace &&
			c.model.info.name === name);
	}

	private refreshChildren(registrations: Registration[]): void {
		const newChildren: ResourceTreeNode[] = [];
		registrations.filter(r => !r.isDeleted).forEach(registration => {
			if (!registration.instanceNamespace || !registration.instanceName) {
				console.warn('Registration is missing required namespace and name values, skipping');
				return;
			}

			const resourceInfo: ResourceInfo = {
				namespace: registration.instanceNamespace,
				name: parseInstanceName(registration.instanceName),
				resourceType: registration.instanceType ?? ''
			};

			let node = this._children.find(n =>
				n.model?.info?.name === resourceInfo.name &&
				n.model?.info?.namespace === resourceInfo.namespace &&
				n.model?.info?.resourceType === resourceInfo.resourceType);

			// If we don't have this child already then create a new node for it
			if (!node) {
				// If we had a stored connectionId copy that over
				resourceInfo.connectionId = this.model.info.resources.find(info =>
					info.namespace === resourceInfo.namespace &&
					info.name === resourceInfo.name &&
					info.resourceType === resourceInfo.resourceType)?.connectionId;

				switch (registration.instanceType) {
					case ResourceType.postgresInstances:
						const postgresModel = new PostgresModel(this.model.info.url, this.model.auth!, resourceInfo, registration);
						node = new PostgresTreeNode(postgresModel, this.model, this._context);
						break;
					case ResourceType.sqlManagedInstances:
						const miaaModel = new MiaaModel(this.model.info.url, this.model.auth!, resourceInfo, registration, this._treeDataProvider);
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
		this._childrenRefreshPromise.resolve();
	}
}
