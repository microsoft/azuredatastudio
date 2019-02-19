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
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { fillInActions } from 'vs/platform/actions/browser/menuItemActionItem';

import {
	DisconnectConnectionAction, AddServerAction,
	DeleteConnectionAction, RefreshAction, EditServerGroupAction
}
	from 'sql/parts/objectExplorer/viewlet/connectionTreeAction';
import {
	ObjectExplorerActionUtilities, ManageConnectionAction, OEAction
} from 'sql/parts/objectExplorer/viewlet/objectExplorerActions';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import { NodeType } from 'sql/parts/objectExplorer/common/nodeType';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TreeUpdateUtils } from 'sql/parts/objectExplorer/viewlet/treeUpdateUtils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { MenuId, IMenuService } from 'vs/platform/actions/common/actions';
import { NewQueryAction, BackupAction, RestoreAction } from 'sql/workbench/common/actions';
import { ConnectionContextKey } from 'sql/parts/connection/common/connectionContextKey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TreeNodeContextKey } from 'sql/parts/objectExplorer/viewlet/treeNodeContextKey';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import * as constants from 'sql/common/constants';

/**
 *  Provides actions for the server tree elements
 */
export class ServerTreeActionProvider extends ContributableActionProvider {

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IScriptingService private _scriptingService: IScriptingService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private _contextKeyService: IContextKeyService
	) {
		super();
	}

	public hasActions(tree: ITree, element: any): boolean {
		return element instanceof ConnectionProfileGroup || (element instanceof ConnectionProfile) || (element instanceof TreeNode);
	}

	/**
	 * Return actions given an element in the tree
	 */
	public getActions(tree: ITree, element: any): IAction[] {
		if (element instanceof ConnectionProfile) {
			return this.getConnectionActions(tree, element);
		}
		if (element instanceof ConnectionProfileGroup) {
			return this.getConnectionProfileGroupActions(tree, element);
		}
		if (element instanceof TreeNode) {
			return this.getObjectExplorerNodeActions({
				tree: tree,
				profile: element.getConnectionProfile(),
				treeNode: element
			});
		}

		return [];
	}

	public hasSecondaryActions(tree: ITree, element: any): boolean {
		return false;
	}

	public getSecondaryActions(tree: ITree, element: any): IAction[] {
		return super.getSecondaryActions(tree, element);
	}

	/**
	 * Return actions for connection elements
	 */
	public getConnectionActions(tree: ITree, profile: ConnectionProfile): IAction[] {
		let node = new TreeNode(NodeType.Server, '', false, '', '', '', undefined, undefined, undefined, undefined);
		return this.getAllActions({
			tree: tree,
			profile: profile,
			treeNode: node
		}, (context) => this.getBuiltinConnectionActions(context));
	}

	private getAllActions(context: ObjectExplorerContext, getDefaultActions: (ObjectExplorerContext) => IAction[]) {
		// Create metadata needed to get a useful set of actions
		let scopedContextService = this.getContextKeyService(context);
		let menu = this.menuService.createMenu(MenuId.ObjectExplorerItemContext, scopedContextService);

		// Fill in all actions
		let actions = getDefaultActions(context);
		let options = { arg: undefined, shouldForwardArgs: true };
		const groups = menu.getActions(options);
		fillInActions(groups, actions, this.contextMenuService);

		// Cleanup
		scopedContextService.dispose();
		menu.dispose();
		return actions;

	}

	private getBuiltinConnectionActions(context: ObjectExplorerContext): IAction[] {
		let actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(ManageConnectionAction, ManageConnectionAction.ID, ManageConnectionAction.LABEL, context.tree));
		this.addNewQueryAction(context, actions);

		if (this._connectionManagementService.isProfileConnected(context.profile)) {
			actions.push(this._instantiationService.createInstance(DisconnectConnectionAction, DisconnectConnectionAction.ID, DisconnectConnectionAction.LABEL, context.profile));
		}
		actions.push(this._instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.DELETE_CONNECTION_LABEL, context.profile));
		actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, context.tree, context.profile));

		return actions;
	}

	private getContextKeyService(context: ObjectExplorerContext): IContextKeyService {
		let scopedContextService = this._contextKeyService.createScoped();
		let connectionContextKey = new ConnectionContextKey(scopedContextService);
		connectionContextKey.set(context.profile);
		let treeNodeContextKey = new TreeNodeContextKey(scopedContextService);
		if (context.treeNode) {
			treeNodeContextKey.set(context.treeNode);
		}
		return scopedContextService;
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
	private getObjectExplorerNodeActions(context: ObjectExplorerContext): IAction[] {
		return this.getAllActions(context, (context) => this.getBuiltInNodeActions(context));
	}

	private getBuiltInNodeActions(context: ObjectExplorerContext): IAction[] {
		let actions: IAction[] = [];
		let treeNode = context.treeNode;
		let isAvailableDatabaseNode = false;
		if (TreeUpdateUtils.isDatabaseNode(treeNode)) {
			if (TreeUpdateUtils.isAvailableDatabaseNode(treeNode)) {
				isAvailableDatabaseNode = true;
				actions.push(this._instantiationService.createInstance(ManageConnectionAction, ManageConnectionAction.ID, ManageConnectionAction.LABEL, context.tree));
				this.addNewQueryAction(context, actions);
			} else {
				return actions;
			}
		}

		this.addScriptingActions(context, actions);

		if (isAvailableDatabaseNode) {
			this.addBackupAction(context, actions);
			this.addRestoreAction(context, actions);
		}

		actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, context.tree, treeNode));

		return actions;
	}

	private addNewQueryAction(context: ObjectExplorerContext, actions: IAction[]): void {
		if (this._queryManagementService.isProviderRegistered(context.profile.providerName)) {
			actions.push(this._instantiationService.createInstance(OEAction, NewQueryAction.ID, NewQueryAction.LABEL));
		}
	}

	private addBackupAction(context: ObjectExplorerContext, actions: IAction[]): void {
		if (this._queryManagementService.isProviderRegistered(context.profile.providerName)) {
			actions.push(this._instantiationService.createInstance(OEAction, BackupAction.ID, BackupAction.LABEL));
		}
	}

	private addRestoreAction(context: ObjectExplorerContext, actions: IAction[]): void {
		if (this._queryManagementService.isProviderRegistered(context.profile.providerName)) {
			actions.push(this._instantiationService.createInstance(OEAction, RestoreAction.ID, RestoreAction.LABEL));
		}
	}

	private addScriptingActions(context: ObjectExplorerContext, actions: IAction[]): void {
		if (this._scriptingService.isProviderRegistered(context.profile.providerName)) {
			let scriptMap: Map<NodeType, any[]> = ObjectExplorerActionUtilities.getScriptMap(context.treeNode);
			let supportedActions = scriptMap.get(context.treeNode.nodeTypeId);
			let self = this;
			if (supportedActions !== null && supportedActions !== undefined) {
				supportedActions.forEach(action => {
					actions.push(self._instantiationService.createInstance(action, action.ID, action.LABEL));
				});
			}
		}
	}
}

interface ObjectExplorerContext {
	tree: ITree;
	profile: ConnectionProfile;
	treeNode?: TreeNode;
}
