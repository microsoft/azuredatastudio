/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { TPromise } from 'vs/base/common/winjs.base';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { ContributableActionProvider } from 'vs/workbench/browser/actions';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import {
	DisconnectConnectionAction, AddServerAction,
	DeleteConnectionAction, RefreshAction, EditServerGroupAction
}
	from 'sql/parts/objectExplorer/viewlet/connectionTreeAction';
import {
	DisconnectAction, ObjectExplorerActionUtilities,
	ManageConnectionAction,
	OEAction
} from 'sql/parts/objectExplorer/viewlet/objectExplorerActions';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import { NodeType } from 'sql/parts/objectExplorer/common/nodeType';
import { ConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { NewProfilerAction } from 'sql/parts/profiler/contrib/profilerActions';
import { TreeUpdateUtils } from 'sql/parts/objectExplorer/viewlet/treeUpdateUtils';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { NewQueryAction } from 'sql/workbench/common/actions';

/**
 *  Provides actions for the server tree elements
 */
export class ServerTreeActionProvider extends ContributableActionProvider {

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super();
	}

	public hasActions(tree: ITree, element: any): boolean {
		return element instanceof ConnectionProfileGroup || (element instanceof ConnectionProfile) || (element instanceof TreeNode);
	}

	/**
	 * Return actions given an element in the tree
	 */
	public getActions(tree: ITree, element: any): TPromise<IAction[]> {
		if (element instanceof ConnectionProfile) {
			return TPromise.as(this.getConnectionActions(tree, element));
		}
		if (element instanceof ConnectionProfileGroup) {
			return TPromise.as(this.getConnectionProfileGroupActions(tree, element));
		}
		if (element instanceof TreeNode) {
			var treeNode = <TreeNode>element;
			return TPromise.as(this.getObjectExplorerNodeActions(tree, treeNode));
		}

		return TPromise.as([]);
	}

	public hasSecondaryActions(tree: ITree, element: any): boolean {
		return false;
	}

	public getSecondaryActions(tree: ITree, element: any): TPromise<IAction[]> {
		return super.getSecondaryActions(tree, element);
	}

	/**
	 * Return actions for connection elements
	 */
	public getConnectionActions(tree: ITree, element: ConnectionProfile): IAction[] {
		let actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(ManageConnectionAction, ManageConnectionAction.ID, ManageConnectionAction.LABEL));
		actions.push(this._instantiationService.createInstance(OEAction, NewQueryAction.ID, NewQueryAction.LABEL));
		if (this._connectionManagementService.isProfileConnected(element)) {
			actions.push(this._instantiationService.createInstance(DisconnectConnectionAction, DisconnectConnectionAction.ID, DisconnectConnectionAction.LABEL));
		}
		actions.push(this._instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.DELETE_CONNECTION_LABEL, element));
		actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, tree, element));

		if (process.env['VSCODE_DEV']) {
			actions.push(this._instantiationService.createInstance(OEAction, NewProfilerAction.ID, NewProfilerAction.LABEL));
		}

		return actions;
	}

	/**
	 * Return actions for connection group elements
	 */
	public getConnectionProfileGroupActions(tree: ITree, element: ConnectionProfileGroup): IAction[] {
		return [
			this._instantiationService.createInstance(AddServerAction, AddServerAction.ID, AddServerAction.LABEL),
			this._instantiationService.createInstance(EditServerGroupAction, EditServerGroupAction.ID, EditServerGroupAction.LABEL, element),
			this._instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.DELETE_CONNECTION_GROUP_LABEL, element)
		];
	}

	/**
	 * Return actions for OE elements
	 */
	public getObjectExplorerNodeActions(tree: ITree, treeNode: TreeNode): IAction[] {
		let actions = [];
		if (TreeUpdateUtils.isDatabaseNode(treeNode)) {
			if (TreeUpdateUtils.isAvailableDatabaseNode(treeNode)) {
				actions.push(this._instantiationService.createInstance(ManageConnectionAction, ManageConnectionAction.ID, ManageConnectionAction.LABEL));
			} else {
				return actions;
			}
		}
		actions.push(this._instantiationService.createInstance(OEAction, NewQueryAction.ID, NewQueryAction.LABEL));
		let scriptMap: Map<NodeType, any[]> = ObjectExplorerActionUtilities.getScriptMap(treeNode);
		let supportedActions = scriptMap.get(treeNode.nodeTypeId);
		let self = this;

		if (supportedActions !== null && supportedActions !== undefined) {
			supportedActions.forEach(action => {
				actions.push(self._instantiationService.createInstance(action, action.ID, action.LABEL));
			});
		}
		actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, tree, treeNode));


		if (treeNode.isTopLevel()) {
			actions.push(this._instantiationService.createInstance(DisconnectAction, DisconnectAction.ID, DisconnectAction.LABEL));
		}

		return actions;
	}
}
