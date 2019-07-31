/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VIEWLET_ID } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerExtensionPoint';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IOEShimService } from 'sql/workbench/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { BaseActionContext } from 'sql/workbench/common/actions';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ScriptCreateAction, ScriptDeleteAction, ScriptSelectAction, ScriptExecuteAction, ScriptAlterAction, EditDataAction } from 'sql/workbench/electron-browser/scriptingActions';

export const SCRIPT_AS_CREATE_COMMAND_ID = 'dataExplorer.scriptAsCreate';
export const SCRIPT_AS_DELETE_COMMAND_ID = 'dataExplorer.scriptAsDelete';
export const SCRIPT_AS_SELECT_COMMAND_ID = 'dataExplorer.scriptAsSelect';
export const SCRIPT_AS_EXECUTE_COMMAND_ID = 'dataExplorer.scriptAsExecute';
export const SCRIPT_AS_ALTER_COMMAND_ID = 'dataExplorer.scriptAsAlter';
export const EDIT_DATA_COMMAND_ID = 'dataExplorer.scriptAsAlter';

// Script as Create
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_CREATE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptCreateAction = new ScriptCreateAction(ScriptCreateAction.ID, ScriptCreateAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptCreateAction.run(baseContext));
	}
});

// Script as Delete
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_DELETE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptDeleteAction = new ScriptDeleteAction(ScriptDeleteAction.ID, ScriptDeleteAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptDeleteAction.run(baseContext));
	}
});

// Script as Select
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_SELECT_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptSelectAction = new ScriptSelectAction(ScriptSelectAction.ID, ScriptSelectAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptSelectAction.run(baseContext));
	}
});

// Script as Execute
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_EXECUTE_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptExecuteAction = new ScriptExecuteAction(ScriptExecuteAction.ID, ScriptExecuteAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptExecuteAction.run(baseContext));
	}
});

// Script as Alter
CommandsRegistry.registerCommand({
	id: SCRIPT_AS_ALTER_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const errorMessageService = accessor.get(IErrorMessageService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const scriptAlterAction = new ScriptAlterAction(ScriptAlterAction.ID, ScriptAlterAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService, errorMessageService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => scriptAlterAction.run(baseContext));
	}
});

// Edit Data
CommandsRegistry.registerCommand({
	id: EDIT_DATA_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		const capabilitiesService = accessor.get(ICapabilitiesService);
		const oeShimService = accessor.get(IOEShimService);
		const queryEditorService = accessor.get(IQueryEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const scriptingService = accessor.get(IScriptingService);
		const progressService = accessor.get(IProgressService);
		const profile = new ConnectionProfile(capabilitiesService, args.$treeItem.payload);
		const baseContext: BaseActionContext = {
			profile: profile,
			object: oeShimService.getNodeInfoForTreeItem(args.$treeItem).metadata
		};
		const editDataAction = new EditDataAction(EditDataAction.ID, EditDataAction.LABEL,
			queryEditorService, connectionManagementService, scriptingService);
		return progressService.withProgress({ location: VIEWLET_ID }, () => editDataAction.run(baseContext));
	}
});
