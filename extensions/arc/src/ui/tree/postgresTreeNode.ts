/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ResourceType } from '../../constants';
import { TreeNode } from './treeNode';
import { PostgresModel } from '../../models/postgresModel';
import { ControllerModel } from '../../models/controllerModel';
import { PostgresDashboard } from '../dashboards/postgres/postgresDashboard';

/**
 * The TreeNode for displaying an Postgres Server group
 */
export class PostgresTreeNode extends TreeNode {

	constructor(private _model: PostgresModel, private _controllerModel: ControllerModel, private _context: vscode.ExtensionContext) {
		super(_model.name, vscode.TreeItemCollapsibleState.None, ResourceType.postgresInstances);
	}

	public async openDashboard(): Promise<void> {
		const postgresDashboard = new PostgresDashboard(this._context, this._controllerModel, this._model);
		await Promise.all([
			postgresDashboard.showDashboard(),
			this._model.refresh()]);
	}
}
