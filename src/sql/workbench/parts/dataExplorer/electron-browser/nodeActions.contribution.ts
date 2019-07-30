/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { SCRIPT_AS_CREATE_COMMAND_ID, SCRIPT_AS_DELETE_COMMAND_ID, SCRIPT_AS_SELECT_COMMAND_ID, SCRIPT_AS_EXECUTE_COMMAND_ID, SCRIPT_AS_ALTER_COMMAND_ID, EDIT_DATA_COMMAND_ID } from 'sql/workbench/parts/dataExplorer/electron-browser/nodeCommand';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/common/mssqlNodeContext';
import { localize } from 'vs/nls';

// Script as Create
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 3,
	command: {
		id: SCRIPT_AS_CREATE_COMMAND_ID,
		title: localize('scriptAsCreate', "Script as Create")
	},
	when: MssqlNodeContext.CanScriptAsCreateOrDelete
});

// Script as Delete
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 4,
	command: {
		id: SCRIPT_AS_DELETE_COMMAND_ID,
		title: localize('scriptAsDelete', "Script as Drop")
	},
	when: MssqlNodeContext.CanScriptAsCreateOrDelete
});

// Script as Select
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 1,
	command: {
		id: SCRIPT_AS_SELECT_COMMAND_ID,
		title: localize('scriptAsSelect', "Select Top 1000")
	},
	when: MssqlNodeContext.CanScriptAsSelect
});

// Script as Execute
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: SCRIPT_AS_EXECUTE_COMMAND_ID,
		title: localize('scriptAsExecute', "Script as Execute")
	},
	when: MssqlNodeContext.CanScriptAsExecute
});

// Script as Alter
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 5,
	command: {
		id: SCRIPT_AS_ALTER_COMMAND_ID,
		title: localize('scriptAsAlter', "Script as Alter")
	},
	when: MssqlNodeContext.CanScriptAsAlter
});

// Edit Data
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'connection',
	order: 2,
	command: {
		id: EDIT_DATA_COMMAND_ID,
		title: localize('editData', "Edit Data")
	},
	when: MssqlNodeContext.CanEditData
});
