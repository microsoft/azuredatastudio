/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IAction, Separator } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import {
	DisconnectConnectionAction, EditConnectionAction,
	DeleteConnectionAction, RefreshAction, EditServerGroupAction, AddServerAction
} from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { MenuId, IMenuService } from 'vs/platform/actions/common/actions';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { ServerInfoContextKey } from 'sql/workbench/services/connection/common/serverInfoContextKey';
import { fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

/**
 *  Provides actions for the server tree elements
 */
export class ServerTreeActionProvider {

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
	}

	/**
	 * Return actions given an element in the tree
	 */
	public getActions(tree: AsyncServerTree | ITree, element: ServerTreeElement): IAction[] {
		if (element instanceof ConnectionProfile) {
			return this.getConnectionActions(tree, element);
		}
		if (element instanceof ConnectionProfileGroup) {
			return this.getConnectionProfileGroupActions(element);
		}
		if (element instanceof TreeNode) {
			const profile = element.getConnectionProfile();
			if (profile) {
				return this.getObjectExplorerNodeActions({
					tree: tree,
					profile,
					treeNode: element
				});
			}
		}
		return [];
	}

	/**
	 * Return actions for connection elements
	 */
	private getConnectionActions(tree: AsyncServerTree | ITree, profile: ConnectionProfile): IAction[] {
		let node = new TreeNode(NodeType.Server, '', false, '', '', '', undefined, undefined, undefined, undefined);
		node.connection = profile;
		return this.getAllActions({
			tree: tree,
			profile: profile,
			treeNode: node
		}, (context) => this.getBuiltinConnectionActions(context));
	}

	private getAllActions(context: ObjectExplorerContext, getDefaultActions: (context: ObjectExplorerContext) => IAction[]) {
		// Create metadata needed to get a useful set of actions
		let scopedContextService = this.getContextKeyService(context);
		let menu = this.menuService.createMenu(MenuId.ObjectExplorerItemContext, scopedContextService);

		// Fill in all actions
		const builtIn = getDefaultActions(context);
		const actions: IAction[] = [];
		const options = { arg: undefined, shouldForwardArgs: true };
		const groups = menu.getActions(options);
		let insertIndex: number | undefined = 0;
		const queryIndex = groups.findIndex(v => {
			if (v[0] === '0_query') {
				return true;
			} else {
				if (v[1].length) {
					insertIndex! += v[1].length;
				}
				return false;
			}
		});
		insertIndex = queryIndex > -1 ? insertIndex + groups[queryIndex][1].length : undefined;
		fillInActions(groups, actions, false);

		if (insertIndex) {
			if (!(actions[insertIndex] instanceof Separator) && builtIn.length > 0) {
				builtIn.unshift(new Separator());
			}
			actions?.splice(insertIndex, 0, ...builtIn);
		} else {
			if (actions.length > 0 && builtIn.length > 0) {
				builtIn.push(new Separator());
			}
			actions.unshift(...builtIn);
		}

		// Cleanup
		scopedContextService.dispose();
		menu.dispose();
		return actions;

	}

	private getBuiltinConnectionActions(context: ObjectExplorerContext): IAction[] {
		let actions: IAction[] = [];

		if (this._connectionManagementService.isProfileConnected(context.profile)) {
			actions.push(this._instantiationService.createInstance(DisconnectConnectionAction, DisconnectConnectionAction.ID, DisconnectConnectionAction.LABEL, context.profile));
		}
		actions.push(this._instantiationService.createInstance(EditConnectionAction, EditConnectionAction.ID, EditConnectionAction.LABEL, context.profile));
		actions.push(this._instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.DELETE_CONNECTION_LABEL, context.profile));

		// Contribute refresh action for scriptable objects via contribution
		if (!this.isScriptableObject(context)) {
			actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, context.tree, context.profile));
		}
		return actions;
	}

	private getContextKeyService(context: ObjectExplorerContext): IContextKeyService {
		let scopedContextService = this._contextKeyService.createScoped(context.tree.getHTMLElement());
		let connectionContextKey = new ConnectionContextKey(scopedContextService, this._queryManagementService);
		let connectionProfile = context && context.profile;
		connectionContextKey.set(connectionProfile);
		let serverInfoContextKey = new ServerInfoContextKey(scopedContextService);
		if (connectionProfile.id) {
			let serverInfo = this._connectionManagementService.getServerInfo(connectionProfile.id);
			if (serverInfo) {
				serverInfoContextKey.set(serverInfo);
			}
		}
		let treeNodeContextKey = new TreeNodeContextKey(scopedContextService, this._capabilitiesService);
		if (context.treeNode) {
			treeNodeContextKey.set(context.treeNode);
		}
		return scopedContextService;
	}

	/**
	 * Return actions for connection group elements
	 */
	private getConnectionProfileGroupActions(element: ConnectionProfileGroup): IAction[] {
		// TODO: Should look into using the MenuRegistry for this
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
		if (treeNode) {
			if (TreeUpdateUtils.isDatabaseNode(treeNode)) {
				if (TreeUpdateUtils.isAvailableDatabaseNode(treeNode)) {
				} else {
					return actions;
				}
			}
		}
		// Contribute refresh action for scriptable objects via contribution
		if (!this.isScriptableObject(context)) {
			actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, context.tree, context.treeNode || context.profile));
		}

		return actions;
	}

	private isScriptableObject(context: ObjectExplorerContext): boolean {
		if (context.treeNode) {
			if (NodeType.SCRIPTABLE_OBJECTS.find(x => x === context?.treeNode?.nodeTypeId)) {
				return true;
			}
		}
		return false;
	}
}

interface ObjectExplorerContext {
	tree: AsyncServerTree | ITree;
	profile: ConnectionProfile;
	treeNode?: TreeNode;
}
