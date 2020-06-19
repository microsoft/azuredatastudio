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

/**
 * The TreeNode for displaying an Azure Arc Controller
 */
export class ControllerTreeNode extends TreeNode {

	private _children: TreeNode[] = [];

	constructor(private _model: ControllerModel, private _context: vscode.ExtensionContext) {
		super(_model.controllerUrl, vscode.TreeItemCollapsibleState.Collapsed, ResourceType.dataControllers);
		_model.onRegistrationsUpdated(registrations => this.refreshChildren(registrations));
		_model.refresh().catch(err => console.log(`Error refreshing Arc Controller model for tree node : ${err}`));
	}

	public async getChildren(): Promise<TreeNode[]> {
		return this._children;
	}

	public async openDashboard(): Promise<void> {
		const controllerDashboard = new ControllerDashboard(this._model);
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
					const postgresModel = new PostgresModel(this._model.controllerUrl, this._model.auth, registration.instanceNamespace, parseInstanceName(registration.instanceName));
					return new PostgresTreeNode(postgresModel, this._model, this._context);
				case ResourceType.sqlManagedInstances:
					const miaaModel = new MiaaModel(this._model.controllerUrl, this._model.auth, registration.instanceNamespace, parseInstanceName(registration.instanceName));
					return new MiaaTreeNode(miaaModel, this._model);
			}
			return undefined;
		}).filter(item => item); // filter out invalid nodes (controllers or ones without required properties)
	}
}
