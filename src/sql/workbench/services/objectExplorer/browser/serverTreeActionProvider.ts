/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree } from 'sql/base/parts/tree/browser/tree';
import { IAction, Separator } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import {
	DisconnectConnectionAction, EditConnectionAction,
	DeleteConnectionAction, RefreshAction, EditServerGroupAction, FilterChildrenAction, RemoveFilterAction, DeleteRecentConnectionsAction, AddServerAction1
} from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { MenuId, IMenuService, MenuItemAction } from 'vs/platform/actions/common/actions';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { ServerInfoContextKey } from 'sql/workbench/services/connection/common/serverInfoContextKey';
import { fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ILogService } from 'vs/platform/log/common/log';

/**
 *  Provides actions for the server tree elements
 */
export class ServerTreeActionProvider {

	private scopedContextService: IContextKeyService;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@ILogService private _logService: ILogService,
	) {
	}

	/**
	 * Return actions given an element in the tree
	 */
	public getActions(tree: AsyncServerTree | ITree | undefined, element: ServerTreeElement, inlineOnly: boolean = false): IAction[] {
		if (element instanceof ConnectionProfile) {
			return tree ? this.getConnectionActions(tree, element, inlineOnly) : [];
		}
		if (element instanceof ConnectionProfileGroup) {
			return this.getConnectionProfileGroupActions(element);
		}
		if (element instanceof TreeNode) {
			const profile = element.getConnectionProfile();
			if (profile) {
				return tree ? this.getObjectExplorerNodeActions({
					tree: tree,
					profile,
					treeNode: element
				}, inlineOnly) : [];
			}
		}
		return [];
	}

	/**
	 * Get the default action for the given element.
	 */
	public getDefaultAction(tree: AsyncServerTree | ITree | undefined, element: ServerTreeElement): IAction | undefined {
		if (tree) {
			const actions = this.getActions(tree, element).filter(a => {
				return a instanceof MenuItemAction && a.isDefault;
			});
			if (actions.length === 1) {
				return actions[0];
			} else if (actions.length > 1) {
				let nodeName: string;
				if (element instanceof ConnectionProfile) {
					nodeName = element.serverName;
				} else if (element instanceof ConnectionProfileGroup) {
					nodeName = element.name;
				} else {
					nodeName = element.label;
				}
				this._logService.error(`Multiple default actions defined for node: ${nodeName}, actions: ${actions.map(a => a.id).join(', ')}`);
			}
		}
		return undefined;
	}

	public getRecentConnectionActions(element: ConnectionProfile): IAction[] {
		return [
			this._instantiationService.createInstance(EditConnectionAction, EditConnectionAction.ID, EditConnectionAction.LABEL, element),
			this._instantiationService.createInstance(DeleteRecentConnectionsAction, DeleteRecentConnectionsAction.ID, DeleteRecentConnectionsAction.LABEL, element)
		]
	}

	/**
	 * Return actions for connection elements
	 */
	private getConnectionActions(tree: AsyncServerTree | ITree | undefined, profile: ConnectionProfile, inlineOnly: boolean = false): IAction[] {
		let node = new TreeNode(NodeType.Server, NodeType.Server, '', false, '', '', '', '', undefined, undefined, undefined, undefined);
		// Only update password and not access tokens to avoid login prompts when opening context menu.
		this._connectionManagementService.addSavedPassword(profile, true);
		node.connection = profile;
		return this.getAllActions({
			tree: tree,
			profile: profile,
			treeNode: node
		}, (context) => this.getBuiltinConnectionActions(context),
			inlineOnly);
	}

	private getAllActions(context: ObjectExplorerContext, getDefaultActions: (context: ObjectExplorerContext) => IAction[], inlineOnly: boolean = false) {
		// Create metadata needed to get a useful set of actions
		let scopedContextService = this.getContextKeyService(context);
		let menu = this.menuService.createMenu(MenuId.ObjectExplorerItemContext, scopedContextService);

		// Fill in all actions
		const builtIn = getDefaultActions(context);
		const actions: IAction[] = [];
		const options = {
			arg: undefined, shouldForwardArgs: true
		};

		let groups = menu.getActions(options);
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

		if (inlineOnly) {
			groups = groups.filter(g => g[0].includes('inline')); // Keeping only inline actions
			fillInActions(groups, actions, false);
			actions.unshift(...builtIn);
			// Moving refresh action to the end of the list
			const refreshIndex = actions.findIndex(f => {
				return f instanceof RefreshAction;
			});
			if (refreshIndex > -1) {
				actions.push(actions.splice(refreshIndex, 1)[0]);
			}
		} else {
			groups = groups.filter(g => !g[0].includes('inline')); // Removing inline actions
			fillInActions(groups, actions, false);
			if (insertIndex) {
				if (!(actions[insertIndex] instanceof Separator) && builtIn.length > 0 && !inlineOnly) {
					builtIn.unshift(new Separator());
				}
				actions?.splice(insertIndex, 0, ...builtIn);
			} else {
				if (actions.length > 0 && builtIn.length > 0) {
					builtIn.push(new Separator());
				}
				actions.unshift(...builtIn);
			}
		}

		// Cleanup
		menu.dispose();
		return actions;
	}

	private getBuiltinConnectionActions(context: ObjectExplorerContext): IAction[] {
		let actions: IAction[] = [];

		const isProfileConnected = this._connectionManagementService.isProfileConnected(context.profile);
		if (isProfileConnected) {
			actions.push(this._instantiationService.createInstance(DisconnectConnectionAction, DisconnectConnectionAction.ID, DisconnectConnectionAction.LABEL, context.profile));
		}
		actions.push(this._instantiationService.createInstance(EditConnectionAction, EditConnectionAction.ID, EditConnectionAction.LABEL, context.profile));
		actions.push(this._instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.DELETE_CONNECTION_LABEL, context.profile));

		// Contribute refresh action for scriptable objects via contribution
		if (isProfileConnected && !this.isScriptableObject(context)) {
			actions.push(this._instantiationService.createInstance(RefreshAction, RefreshAction.ID, RefreshAction.LABEL, context.tree, context.profile));
		}
		return actions;
	}

	private getContextKeyService(context: ObjectExplorerContext): IContextKeyService {
		if (!this.scopedContextService) {
			if (context.tree instanceof AsyncServerTree) {
				this.scopedContextService = context.tree.contextKeyService;
			} else {
				this.scopedContextService = this._contextKeyService.createScoped(context.tree.getHTMLElement());
			}
		}
		let connectionContextKey = new ConnectionContextKey(this.scopedContextService, this._queryManagementService);
		let connectionProfile = context && context.profile;
		connectionContextKey.set(connectionProfile);
		let serverInfoContextKey = new ServerInfoContextKey(this.scopedContextService);
		if (connectionProfile.id) {
			let serverInfo = this._connectionManagementService.getServerInfo(connectionProfile.id);
			if (serverInfo) {
				serverInfoContextKey.set(serverInfo);
			}
		}
		let treeNodeContextKey = new TreeNodeContextKey(this.scopedContextService, this._capabilitiesService);
		if (context.treeNode) {
			treeNodeContextKey.set(context.treeNode);
		}
		return this.scopedContextService;
	}

	/**
	 * Return actions for connection group elements
	 */
	private getConnectionProfileGroupActions(element: ConnectionProfileGroup): IAction[] {
		// TODO: Should look into using the MenuRegistry for this
		return [
			this._instantiationService.createInstance(AddServerAction1, AddServerAction1.ID, AddServerAction1.LABEL),
			this._instantiationService.createInstance(EditServerGroupAction, EditServerGroupAction.ID, EditServerGroupAction.LABEL, element),
			this._instantiationService.createInstance(DeleteConnectionAction, DeleteConnectionAction.ID, DeleteConnectionAction.DELETE_CONNECTION_GROUP_LABEL, element)
		];
	}

	/**
	 * Return actions for OE elements
	 */
	private getObjectExplorerNodeActions(context: ObjectExplorerContext, inlineOnly: boolean = false): IAction[] {
		return this.getAllActions(context, (context) => this.getBuiltInNodeActions(context), inlineOnly);
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
			// Adding filter action if the node has filter properties
			if (treeNode?.filterProperties?.length > 0) {
				actions.push(this._instantiationService.createInstance(FilterChildrenAction, FilterChildrenAction.ID, FilterChildrenAction.LABEL, context.treeNode));
			}
			// Adding remove filter action if the node has filters applied to it and the action is not inline only.
			if (treeNode?.filters?.length > 0) {
				actions.push(this._instantiationService.createInstance(RemoveFilterAction, RemoveFilterAction.ID, RemoveFilterAction.LABEL, context.treeNode, context.tree, undefined));
			}
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
	tree: AsyncServerTree | ITree | undefined;
	profile: ConnectionProfile;
	treeNode?: TreeNode;
}
