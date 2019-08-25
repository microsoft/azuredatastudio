/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IViewsService } from 'vs/workbench/common/views';
import { ObjectExplorerActionsContext } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { ConnectionViewletPanel } from 'sql/workbench/parts/dataExplorer/browser/connectionViewletPanel';
import Severity from 'vs/base/common/severity';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export class RefreshAction extends Action {

	public static ID = 'objectExplorer.refresh';
	public static LABEL = localize('connectionTree.refresh', "Refresh");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private readonly _objectExplorerService: IObjectExplorerService,
		@IErrorMessageService private readonly _errorMessageService: IErrorMessageService,
		@ICapabilitiesService private readonly capabilitiesService: ICapabilitiesService,
		@IViewsService private readonly _viewsService: IViewsService
	) {
		super(id, label);
	}
	public async run(actionContext: ObjectExplorerActionsContext): Promise<boolean> {
		let treeNode: TreeNode;
		if (actionContext.isConnectionNode) {
			let connection = new ConnectionProfile(this.capabilitiesService, actionContext.connectionProfile);
			if (this._connectionManagementService.isConnected(undefined, connection)) {
				treeNode = this._objectExplorerService.getObjectExplorerNode(connection);
				if (treeNode === undefined) {
					this._objectExplorerService.updateObjectExplorerNodes(connection.toIConnectionProfile()).then(() => {
						treeNode = this._objectExplorerService.getObjectExplorerNode(connection);
					});
				}
			}
		} else {
			treeNode = await this._objectExplorerService.getTreeNode(actionContext.connectionProfile.id, actionContext.nodeInfo.nodePath);
		}

		if (treeNode) {
			const view = await this._viewsService.openView(ConnectionViewletPanel.ID) as ConnectionViewletPanel;
			const tree = view.serversTree;
			return tree.collapse(treeNode).then(() => {
				return this._objectExplorerService.refreshTreeNode(treeNode.getSession(), treeNode).then(() => {
					return tree.refresh(treeNode).then(() => {
						return tree.expand(treeNode);
					}, refreshError => {
						return Promise.resolve(true);
					});
				}, error => {
					this.showError(error);
					return Promise.resolve(true);
				});
			}, collapseError => {
				return Promise.resolve(true);
			});
		}
		return Promise.resolve(true);
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}
