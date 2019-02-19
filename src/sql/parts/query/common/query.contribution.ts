/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!sql/media/overwriteVsIcons';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode, KeyChord } from 'vs/base/common/keyCodes';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { QueryResultsEditor } from 'sql/parts/query/editor/queryResultsEditor';
import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import * as queryContext from 'sql/parts/query/common/queryContext';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { EditDataEditor } from 'sql/parts/editData/editor/editDataEditor';
import { EditDataInput } from 'sql/parts/editData/common/editDataInput';
import {
	RunQueryKeyboardAction, RunCurrentQueryKeyboardAction, CancelQueryKeyboardAction, RefreshIntellisenseKeyboardAction, ToggleQueryResultsKeyboardAction,
	RunQueryShortcutAction, RunCurrentQueryWithActualPlanKeyboardAction, FocusOnCurrentQueryKeyboardAction, ParseSyntaxAction
} from 'sql/parts/query/execution/keyboardQueryActions';
import * as gridActions from 'sql/parts/grid/views/gridActions';
import * as gridCommands from 'sql/parts/grid/views/gridCommands';
import { QueryPlanEditor } from 'sql/parts/queryPlan/queryPlanEditor';
import { QueryPlanInput } from 'sql/parts/queryPlan/queryPlanInput';
import * as Constants from 'sql/parts/query/common/constants';
import { localize } from 'vs/nls';
import { EditDataResultsEditor } from 'sql/parts/editData/editor/editDataResultsEditor';
import { EditDataResultsInput } from 'sql/parts/editData/common/editDataResultsInput';

const gridCommandsWeightBonus = 100; // give our commands a little bit more weight over other default list/tree commands

export const QueryEditorVisibleCondition = ContextKeyExpr.has(queryContext.queryEditorVisibleId);
export const ResultsGridFocusCondition = ContextKeyExpr.and(ContextKeyExpr.has(queryContext.resultsVisibleId), ContextKeyExpr.has(queryContext.resultsGridFocussedId));
export const ResultsMessagesFocusCondition = ContextKeyExpr.and(ContextKeyExpr.has(queryContext.resultsVisibleId), ContextKeyExpr.has(queryContext.resultsMessagesFocussedId));

// Editor
const queryResultsEditorDescriptor = new EditorDescriptor(
	QueryResultsEditor,
	QueryResultsEditor.ID,
	'QueryResults'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryResultsEditorDescriptor, [new SyncDescriptor(QueryResultsInput)]);

// Editor
const queryEditorDescriptor = new EditorDescriptor(
	QueryEditor,
	QueryEditor.ID,
	'Query'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryEditorDescriptor, [new SyncDescriptor(QueryInput)]);

// Query Plan editor registration

const queryPlanEditorDescriptor = new EditorDescriptor(
	QueryPlanEditor,
	QueryPlanEditor.ID,
	'QueryPlan'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryPlanEditorDescriptor, [new SyncDescriptor(QueryPlanInput)]);

// Editor
const editDataEditorDescriptor = new EditorDescriptor(
	EditDataEditor,
	EditDataEditor.ID,
	'EditData'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(editDataEditorDescriptor, [new SyncDescriptor(EditDataInput)]);

// Editor
const editDataResultsEditorDescriptor = new EditorDescriptor(
	EditDataResultsEditor,
	EditDataResultsEditor.ID,
	'EditDataResults'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(editDataResultsEditorDescriptor, [new SyncDescriptor(EditDataResultsInput)]);

let actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);

// Query Actions
actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		RunQueryKeyboardAction,
		RunQueryKeyboardAction.ID,
		RunQueryKeyboardAction.LABEL,
		{ primary: KeyCode.F5 }
	),
	RunQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		RunCurrentQueryKeyboardAction,
		RunCurrentQueryKeyboardAction.ID,
		RunCurrentQueryKeyboardAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.F5 }
	),
	RunCurrentQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		RunCurrentQueryWithActualPlanKeyboardAction,
		RunCurrentQueryWithActualPlanKeyboardAction.ID,
		RunCurrentQueryWithActualPlanKeyboardAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.KEY_M }
	),
	RunCurrentQueryWithActualPlanKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		CancelQueryKeyboardAction,
		CancelQueryKeyboardAction.ID,
		CancelQueryKeyboardAction.LABEL,
		{ primary: KeyMod.Alt | KeyCode.PauseBreak }
	),
	CancelQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		RefreshIntellisenseKeyboardAction,
		RefreshIntellisenseKeyboardAction.ID,
		RefreshIntellisenseKeyboardAction.LABEL
	),
	RefreshIntellisenseKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		FocusOnCurrentQueryKeyboardAction,
		FocusOnCurrentQueryKeyboardAction.ID,
		FocusOnCurrentQueryKeyboardAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_O }
	),
	FocusOnCurrentQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		ParseSyntaxAction,
		ParseSyntaxAction.ID,
		ParseSyntaxAction.LABEL
	),
	ParseSyntaxAction.LABEL
);

// Grid actions

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		ToggleQueryResultsKeyboardAction,
		ToggleQueryResultsKeyboardAction.ID,
		ToggleQueryResultsKeyboardAction.LABEL,
		{ primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KEY_R },
		QueryEditorVisibleCondition
	),
	ToggleQueryResultsKeyboardAction.LABEL
);

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_COPY_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.KEY_C,
	handler: gridCommands.copySelection
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.MESSAGES_SELECTALL_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsMessagesFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.KEY_A,
	handler: gridCommands.selectAllMessages
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_SELECTALL_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.KEY_A,
	handler: gridCommands.selectAll
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.MESSAGES_COPY_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsMessagesFocusCondition,
	primary: KeyMod.CtrlCmd | KeyCode.KEY_C,
	handler: gridCommands.copyMessagesSelection
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_SAVECSV_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_R, KeyMod.CtrlCmd | KeyCode.KEY_C),
	handler: gridCommands.saveAsCsv
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_SAVEJSON_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_R, KeyMod.CtrlCmd | KeyCode.KEY_J),
	handler: gridCommands.saveAsJson
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_SAVEEXCEL_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_R, KeyMod.CtrlCmd | KeyCode.KEY_E),
	handler: gridCommands.saveAsExcel
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_SAVEXML_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_R, KeyMod.CtrlCmd | KeyCode.KEY_X),
	handler: gridCommands.saveAsXml
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_VIEWASCHART_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_R, KeyMod.CtrlCmd | KeyCode.KEY_V),
	handler: gridCommands.viewAsChart
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GRID_GOTONEXTGRID_ID,
	weight: KeybindingWeight.EditorContrib,
	when: ResultsGridFocusCondition,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_R, KeyMod.CtrlCmd | KeyCode.KEY_N),
	handler: gridCommands.goToNextGrid
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.TOGGLERESULTS_ID,
	weight: KeybindingWeight.EditorContrib,
	when: QueryEditorVisibleCondition,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_R,
	handler: gridCommands.toggleResultsPane
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.TOGGLEMESSAGES_ID,
	weight: KeybindingWeight.EditorContrib,
	when: QueryEditorVisibleCondition,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_Y,
	handler: gridCommands.toggleMessagePane
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: gridActions.GOTONEXTQUERYOUTPUTTAB_ID,
	weight: KeybindingWeight.EditorContrib,
	when: QueryEditorVisibleCondition,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_P,
	handler: gridCommands.goToNextQueryOutputTab
});

// Intellisense and other configuration options
let registryProperties = {
	'sql.messagesDefaultOpen': {
		'type': 'boolean',
		'description': localize('sql.messagesDefaultOpen', 'True for the messages pane to be open by default; false for closed'),
		'default': true
	},
	'sql.saveAsCsv.includeHeaders': {
		'type': 'boolean',
		'description': localize('sql.saveAsCsv.includeHeaders', '[Optional] When true, column headers are included when saving results as CSV'),
		'default': true
	},
	'sql.saveAsCsv.delimiter': {
		'type': 'string',
		'description': localize('sql.saveAsCsv.delimiter', '[Optional] The custom delimiter to use between values when saving as CSV'),
		'default': ','
	},
	'sql.saveAsCsv.lineSeperator': {
		'type': '',
		'description': localize('sql.saveAsCsv.lineSeperator', '[Optional] Character(s) used for seperating rows when saving results as CSV'),
		'default': null
	},
	'sql.saveAsCsv.textIdentifier': {
		'type': 'string',
		'description': localize('sql.saveAsCsv.textIdentifier', '[Optional] Character used for enclosing text fields when saving results as CSV'),
		'default': '\"'
	},
	'sql.saveAsCsv.encoding': {
		'type': 'string',
		'description': localize('sql.saveAsCsv.encoding', '[Optional] File encoding used when saving results as CSV'),
		'default': 'utf-8'
	},
	'sql.results.streaming': {
		'type': 'boolean',
		'description': localize('sql.results.streaming', 'Enable results streaming; contains few minor visual issues'),
		'default': true
	},
	'sql.saveAsXml.formatted': {
		'type': 'string',
		'description': localize('sql.saveAsXml.formatted', '[Optional] When true, XML output will be formatted when saving results as XML'),
		'default': true
	},
	'sql.saveAsXml.encoding': {
		'type': 'string',
		'description': localize('sql.saveAsXml.encoding', '[Optional] File encoding used when saving results as XML'),
		'default': 'utf-8'
	},
	'sql.copyIncludeHeaders': {
		'type': 'boolean',
		'description': localize('sql.copyIncludeHeaders', '[Optional] Configuration options for copying results from the Results View'),
		'default': false
	},
	'sql.copyRemoveNewLine': {
		'type': 'boolean',
		'description': localize('sql.copyRemoveNewLine', '[Optional] Configuration options for copying multi-line results from the Results View'),
		'default': true
	},
	'sql.showBatchTime': {
		'type': 'boolean',
		'description': localize('sql.showBatchTime', '[Optional] Should execution time be shown for individual batches'),
		'default': false
	},
	'sql.chart.defaultChartType': {
		'enum': Constants.allChartTypes,
		'default': Constants.chartTypeHorizontalBar,
		'description': localize('defaultChartType', "[Optional] the default chart type to use when opening Chart Viewer from a Query Results")
	},
	'sql.tabColorMode': {
		'type': 'string',
		'enum': [Constants.tabColorModeOff, Constants.tabColorModeBorder, Constants.tabColorModeFill],
		'enumDescriptions': [
			localize('tabColorMode.off', "Tab coloring will be disabled"),
			localize('tabColorMode.border', "The top border of each editor tab will be colored to match the relevant server group"),
			localize('tabColorMode.fill', "Each editor tab's background color will match the relevant server group"),
		],
		'default': Constants.tabColorModeOff,
		'description': localize('tabColorMode', "Controls how to color tabs based on the server group of their active connection")
	},
	'sql.showConnectionInfoInTitle': {
		'type': 'boolean',
		'description': localize('showConnectionInfoInTitle', "Controls whether to show the connection info for a tab in the title."),
		'default': true
	},
	'sql.promptToSaveGeneratedFiles': {
		'type': 'boolean',
		'default': false,
		'description': localize('sql.promptToSaveGeneratedFiles', 'Prompt to save generated SQL files')
	},
	'mssql.intelliSense.enableIntelliSense': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableIntelliSense', 'Should IntelliSense be enabled')
	},
	'mssql.intelliSense.enableErrorChecking': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableErrorChecking', 'Should IntelliSense error checking be enabled')
	},
	'mssql.intelliSense.enableSuggestions': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableSuggestions', 'Should IntelliSense suggestions be enabled')
	},
	'mssql.intelliSense.enableQuickInfo': {
		'type': 'boolean',
		'default': true,
		'description': localize('mssql.intelliSense.enableQuickInfo', 'Should IntelliSense quick info be enabled')
	},
	'mssql.intelliSense.lowerCaseSuggestions': {
		'type': 'boolean',
		'default': false,
		'description': localize('mssql.intelliSense.lowerCaseSuggestions', 'Should IntelliSense suggestions be lowercase')
	}
};

// Setup keybindings
let initialShortcuts = [
	{ name: 'sp_help', primary: KeyMod.Alt + KeyCode.F2 },
	// Note: using Ctrl+Shift+N since Ctrl+N is used for "open editor at index" by default. This means it's different from SSMS
	{ name: 'sp_who', primary: KeyMod.WinCtrl + KeyMod.Shift + KeyCode.KEY_1 },
	{ name: 'sp_lock', primary: KeyMod.WinCtrl + KeyMod.Shift + KeyCode.KEY_2 }
];

for (let i = 0; i < 9; i++) {
	const queryIndex = i + 1;
	let settingKey = `sql.query.shortcut${queryIndex}`;
	let defaultVal = i < initialShortcuts.length ? initialShortcuts[i].name : '';
	let defaultPrimary = i < initialShortcuts.length ? initialShortcuts[i].primary : null;

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: `workbench.action.query.shortcut${queryIndex}`,
		weight: KeybindingWeight.WorkbenchContrib,
		when: QueryEditorVisibleCondition,
		primary: defaultPrimary,
		handler: accessor => {
			accessor.get(IInstantiationService).createInstance(RunQueryShortcutAction).run(queryIndex);
		}
	});
	registryProperties[settingKey] = {
		'type': 'string',
		'default': defaultVal,
		'description': localize('queryShortcutDescription',
			'Set keybinding workbench.action.query.shortcut{0} to run the shortcut text as a procedure call. Any selected text in the query editor will be passed as a parameter',
			queryIndex)
	};
}

// Register the query-related configuration options
let configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'sqlEditor',
	'title': 'SQL Editor',
	'type': 'object',
	'properties': registryProperties
});
