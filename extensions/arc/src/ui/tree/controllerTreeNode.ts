/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TreeNode } from './treeNode';
import { MiaaTreeNode } from './miaaTreeNode';
import { ResourceType } from '../../constants';
import { PostgresTreeNode } from './postgresTreeNode';
import { ControllerModel, Registration } from '../../models/controllerModel';
import { ControllerDashboard } from '../dashboards/controller/controllerDashboard';
import { PostgresModel } from '../../models/postgresModel';
import { parseInstanceName } from '../../common/utils';
import { MiaaModel } from '../../models/miaaModel';
import { Deferred } from '../../common/promise';
import { RefreshTreeNode } from './refreshTreeNode';

/**
 * The TreeNode for displaying an Azure Arc Controller
 */
export class ControllerTreeNode extends TreeNode {

	private _children: TreeNode[] = [];
	private _childrenRefreshPromise = new Deferred();

	constructor(public model: ControllerModel, private _context: vscode.ExtensionContext) {
		super(model.info.url, vscode.TreeItemCollapsibleState.Collapsed, ResourceType.dataControllers);
		model.onRegistrationsUpdated(registrations => this.refreshChildren(registrations));
	}

	public async getChildren(): Promise<TreeNode[]> {
		// First reset our deferred promise so we're sure we'll get the refreshed children
		this._childrenRefreshPromise = new Deferred();
		try {
			await this.model.refresh();
			await this._childrenRefreshPromise.promise;
		} catch (err) {
			// Couldn't get the children and TreeView doesn't have a way to collapse a node
			// in a way that will refetch its children when expanded again so instead we
			// display a tempory node that will prompt the user to re-enter credentials
			return [new RefreshTreeNode(this)];
		}

		return this._children;
	}

	public async openDashboard(): Promise<void> {
		const controllerDashboard = new ControllerDashboard(this.model);
		await controllerDashboard.showDashboard();
	}

	private refreshChildren(registrations: Registration[]): void {
		this._children = <TreeNode[]>registrations.map(registration => {
			if (!registration.instanceNamespace || !registration.instanceName) {
				console.warn('Registration is missing required namespace and name values, skipping');
				return undefined;
			}
			switch (registration.instanceType) {
				case ResourceType.postgresInstances:
					const postgresModel = new PostgresModel(this.model.info.url, this.model.auth!, registration.instanceNamespace, parseInstanceName(registration.instanceName));
					return new PostgresTreeNode(postgresModel, this.model, this._context);
				case ResourceType.sqlManagedInstances:
					const miaaModel = new MiaaModel(this.model.info.url, this.model.auth!, registration.instanceNamespace, parseInstanceName(registration.instanceName));
					return new MiaaTreeNode(miaaModel, this.model);
			}
			return undefined;
		}).filter(item => item); // filter out invalid nodes (controllers or ones without required properties)
		this._childrenRefreshPromise.resolve();
	}
}
