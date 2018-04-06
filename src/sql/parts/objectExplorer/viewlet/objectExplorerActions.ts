/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IConnectionManagementService, IConnectionCompletionOptions, IErrorMessageService } from 'sql/parts/connection/common/connectionManagement';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import {
	NewQueryAction, ScriptSelectAction, EditDataAction, ScriptCreateAction,
	ScriptExecuteAction, ScriptDeleteAction, ScriptAlterAction
} from 'sql/workbench/common/actions';
import { NodeType } from 'sql/parts/objectExplorer/common/nodeType';
import { TreeUpdateUtils } from 'sql/parts/objectExplorer/viewlet/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/parts/objectExplorer/viewlet/treeSelectionHandler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IScriptingService } from 'sql/services/scripting/scriptingService';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { IObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import * as Constants from 'sql/parts/connection/common/constants';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

export class ObjectExplorerActionsContext {
	public treeNode: TreeNode;
	public connectionProfile: ConnectionProfile;
	public container: HTMLElement;
	public tree: ITree;
}

export class OEAction extends ExecuteCommandAction {
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ICommandService commandService: ICommandService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(id, label, commandService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);


		let profile: IConnectionProfile;
		if (actionContext.connectionProfile) {
			profile = actionContext.connectionProfile;
		} else {
			profile = TreeUpdateUtils.getConnectionProfile(<TreeNode>actionContext.treeNode);
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);

		return super.run(profile).then(() => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return true;
		});
	}
}

export class ManageConnectionAction extends Action {
	public static ID = 'objectExplorer.manage';
	public static LABEL = localize('ManageAction', 'Manage');

	private _connectionProfile: ConnectionProfile;
	private _objectExplorerTreeNode: TreeNode;
	private _treeSelectionHandler: TreeSelectionHandler;

	protected _container: HTMLElement;

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService?: IObjectExplorerService,
	) {
		super(id, label);
	}

	run(actionContext: ObjectExplorerActionsContext): TPromise<any> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._treeSelectionHandler.onTreeActionStateChange(true);
		let promise = new TPromise<boolean>((resolve, reject) => {
			this.doManage(actionContext).then((success) => {
				this.done();
				resolve(success);
			}, error => {
				this.done();
				reject(error);
			});
		});
		return promise;
	}

	private doManage(actionContext: ObjectExplorerActionsContext): Thenable<boolean> {
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._connectionProfile = actionContext.connectionProfile;
			this._objectExplorerTreeNode = actionContext.treeNode;
			if (this._connectionProfile === undefined && TreeUpdateUtils.isDatabaseNode(this._objectExplorerTreeNode)) {
				this._connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
			}
			this._container = actionContext.container;
		}

		if (!this._connectionProfile) {
			// This should never happen. There should be always a valid connection if the manage action is called for
			// an OE node or a database node
			return TPromise.wrap(true);
		}

		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showConnectionDialogOnError: true,
			showDashboard: true,
			showFirewallRuleOnError: true
		};

		// If it's a database node just open a database connection and open dashboard,
		// the node is already from an open OE session we don't need to create new session
		if (TreeUpdateUtils.isAvailableDatabaseNode(this._objectExplorerTreeNode)) {
			return this._connectionManagementService.showDashboard(this._connectionProfile);
		} else {
			return TreeUpdateUtils.connectAndCreateOeSession(this._connectionProfile, options, this._connectionManagementService, this._objectExplorerService, actionContext.tree);
		}
	}

	private done() {
		this._treeSelectionHandler.onTreeActionStateChange(false);
	}

	dispose(): void {
		super.dispose();
	}
}

export class OEScriptSelectAction extends ScriptSelectAction {
	public static ID = 'objectExplorer.' + ScriptSelectAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var ownerUri = this._connectionManagementService.getConnectionId(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEEditDataAction extends EditDataAction {
	public static ID = 'objectExplorer.' + EditDataAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label, _queryEditorService, _connectionManagementService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return true;
		});
	}
}

export class OEScriptCreateAction extends ScriptCreateAction {
	public static ID = 'objectExplorer.' + ScriptCreateAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionId(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptExecuteAction extends ScriptExecuteAction {
	public static ID = 'objectExplorer.' + ScriptExecuteAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionId(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptAlterAction extends ScriptAlterAction {
	public static ID = 'objectExplorer.' + ScriptAlterAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionId(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class OEScriptDeleteAction extends ScriptDeleteAction {
	public static ID = 'objectExplorer.' + ScriptDeleteAction.ID;
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label, _queryEditorService, _connectionManagementService, _scriptingService, _errorMessageService);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);
		var connectionProfile = TreeUpdateUtils.getConnectionProfile(<TreeNode>this._objectExplorerTreeNode);
		var metadata = (<TreeNode>this._objectExplorerTreeNode).metadata;
		var ownerUri = this._connectionManagementService.getConnectionId(connectionProfile);
		ownerUri = this._connectionManagementService.getFormattedUri(ownerUri, connectionProfile);

		return super.run({ profile: connectionProfile, object: metadata }).then((result) => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return result;
		});
	}
}

export class DisconnectAction extends Action {
	public static ID = 'objectExplorer.disconnect';
	public static LABEL = localize('objectExplorAction.disconnect', 'Disconnect');
	private _objectExplorerTreeNode: TreeNode;
	private _container: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(actionContext: any): TPromise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		if (actionContext instanceof ObjectExplorerActionsContext) {
			//set objectExplorerTreeNode for context menu clicks
			this._objectExplorerTreeNode = actionContext.treeNode;
			this._container = actionContext.container;
		}

		var connectionProfile = (<TreeNode>this._objectExplorerTreeNode).getConnectionProfile();
		if (this.connectionManagementService.isProfileConnected(connectionProfile)) {
			this._treeSelectionHandler.onTreeActionStateChange(true);

			this.connectionManagementService.disconnect(connectionProfile).then(() => {
				this._treeSelectionHandler.onTreeActionStateChange(false);
			});
		}

		return TPromise.as(true);
	}
}

export class ObjectExplorerActionUtilities {

	public static readonly objectExplorerElementClass = 'object-element-group';
	public static readonly connectionElementClass = 'connection-tile';


	private static getGroupContainer(container: HTMLElement, elementName: string): HTMLElement {
		var element = container;
		while (element && element.className !== elementName) {
			element = element.parentElement;
		}
		return element ? element.parentElement : undefined;
	}

	public static showLoadingIcon(container: HTMLElement, elementName: string): void {
		if (container) {
			let groupContainer = this.getGroupContainer(container, elementName);
			if (groupContainer) {
				groupContainer.classList.add('icon');
				groupContainer.classList.add('in-progress');
			}
		}
	}

	public static hideLoadingIcon(container: HTMLElement, elementName: string): void {
		if (container) {
			let element = this.getGroupContainer(container, elementName);
			if (element && element.classList) {
				element.classList.remove('icon');
				element.classList.remove('in-progress');
			}
		}
	}

	public static getScriptMap(treeNode: TreeNode): Map<NodeType, any[]> {
		let scriptMap = new Map<NodeType, any[]>();

		let isMssqlProvider: boolean = true;
		if (treeNode) {
			let connectionProfile = treeNode.getConnectionProfile();
			if (connectionProfile) {
				isMssqlProvider = connectionProfile.providerName === Constants.mssqlProviderName;
			}
		}

		let basicScripting = [OEScriptCreateAction, OEScriptDeleteAction];
		let storedProcedureScripting = isMssqlProvider ? [OEScriptCreateAction, OEScriptAlterAction, OEScriptDeleteAction, OEScriptExecuteAction] :
			basicScripting;

		let viewScripting = isMssqlProvider ? [OEScriptSelectAction, OEScriptCreateAction, OEScriptAlterAction, OEScriptDeleteAction] :
			[OEScriptSelectAction, OEScriptCreateAction, OEScriptDeleteAction];

		let functionScripting = isMssqlProvider ? [OEScriptCreateAction, OEScriptAlterAction, OEScriptDeleteAction] :
			basicScripting;
		scriptMap.set(NodeType.AggregateFunction, functionScripting);
		scriptMap.set(NodeType.PartitionFunction, functionScripting);
		scriptMap.set(NodeType.ScalarValuedFunction, functionScripting);
		scriptMap.set(NodeType.Schema, basicScripting);
		scriptMap.set(NodeType.StoredProcedure, storedProcedureScripting);
		scriptMap.set(NodeType.Table, [OEScriptSelectAction, OEEditDataAction, OEScriptCreateAction, OEScriptDeleteAction]);
		scriptMap.set(NodeType.TableValuedFunction, functionScripting);
		scriptMap.set(NodeType.User, basicScripting);
		scriptMap.set(NodeType.UserDefinedTableType, basicScripting);
		scriptMap.set(NodeType.View, viewScripting);
		return scriptMap;
	}
}

