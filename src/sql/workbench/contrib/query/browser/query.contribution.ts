/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IConfigurationRegistry, Extensions as ConfigExtensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncActionDescriptor, MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode, KeyChord } from 'vs/base/common/keyCodes';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ContextKeyExpr, ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';

import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryResultsEditor } from 'sql/workbench/contrib/query/browser/queryResultsEditor';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import * as queryContext from 'sql/workbench/contrib/query/common/queryContext';
import {
	RunQueryKeyboardAction, RunCurrentQueryKeyboardAction, CancelQueryKeyboardAction, RefreshIntellisenseKeyboardAction, ToggleQueryResultsKeyboardAction,
	RunQueryShortcutAction, RunCurrentQueryWithActualPlanKeyboardAction, FocusOnCurrentQueryKeyboardAction, ParseSyntaxAction
} from 'sql/workbench/contrib/query/browser/keyboardQueryActions';
import * as gridActions from 'sql/workbench/contrib/editData/browser/gridActions';
import * as gridCommands from 'sql/workbench/contrib/editData/browser/gridCommands';
import { localize } from 'vs/nls';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';

import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { TimeElapsedStatusBarContributions, RowCountStatusBarContributions, QueryStatusStatusBarContributions } from 'sql/workbench/contrib/query/browser/statusBarItems';
import { SqlFlavorStatusbarItem, ChangeFlavorAction } from 'sql/workbench/contrib/query/browser/flavorStatus';
import { IEditorInputFactoryRegistry, Extensions as EditorInputFactoryExtensions } from 'vs/workbench/common/editor';
import { FileQueryEditorInput } from 'sql/workbench/contrib/query/common/fileQueryEditorInput';
import { FileQueryEditorInputFactory, UntitledQueryEditorInputFactory, QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/browser/queryInputFactory';
import { UntitledQueryEditorInput } from 'sql/workbench/common/editor/query/untitledQueryEditorInput';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { NewQueryTask, OE_NEW_QUERY_ACTION_ID, DE_NEW_QUERY_COMMAND_ID } from 'sql/workbench/contrib/query/browser/queryActions';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const QueryEditorVisibleCondition = ContextKeyExpr.has(queryContext.queryEditorVisibleId);
export const ResultsGridFocusCondition = ContextKeyExpr.and(ContextKeyExpr.has(queryContext.resultsVisibleId), ContextKeyExpr.has(queryContext.resultsGridFocussedId));
export const ResultsMessagesFocusCondition = ContextKeyExpr.and(ContextKeyExpr.has(queryContext.resultsVisibleId), ContextKeyExpr.has(queryContext.resultsMessagesFocussedId));

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(FileQueryEditorInput.ID, FileQueryEditorInputFactory);

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(UntitledQueryEditorInput.ID, UntitledQueryEditorInputFactory);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation(QueryEditorLanguageAssociation.languages, QueryEditorLanguageAssociation, QueryEditorLanguageAssociation.isDefault);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(EditorDescriptor.create(QueryResultsEditor, QueryResultsEditor.ID, localize('queryResultsEditor.name', "Query Results")), [new SyncDescriptor(QueryResultsInput)]);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(EditorDescriptor.create(QueryEditor, QueryEditor.ID, localize('queryEditor.name', "Query Editor")), [new SyncDescriptor(FileQueryEditorInput), new SyncDescriptor(UntitledQueryEditorInput)]);

const actionRegistry = <IWorkbenchActionRegistry>Registry.as(ActionExtensions.WorkbenchActions);

new NewQueryTask().registerTask();

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 1,
	command: {
		id: OE_NEW_QUERY_ACTION_ID,
		title: localize('newQuery', "New Query")
	},
	when: ContextKeyExpr.or(ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.NodeType.isEqualTo('Server')), ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.NodeType.isEqualTo('Database')))
});

// New Query
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: '0_query',
	order: 1,
	command: {
		id: DE_NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', "New Query")
	},
	when: MssqlNodeContext.IsDatabaseOrServer
});

const ExplorerNewQueryActionID = 'explorer.query';
CommandsRegistry.registerCommand(ExplorerNewQueryActionID, (accessor, context: ManageActionContext) => {
	const commandService = accessor.get(ICommandService);
	return commandService.executeCommand(NewQueryTask.ID, context.profile);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerNewQueryActionID,
		title: NewQueryTask.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});

// Query Actions
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		RunQueryKeyboardAction,
		RunQueryKeyboardAction.ID,
		RunQueryKeyboardAction.LABEL,
		{ primary: KeyCode.F5 }
	),
	RunQueryKeyboardAction.LABEL
);

// Only show Run Query if the active editor is a query editor.
MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
	command: { id: RunQueryKeyboardAction.ID, title: RunQueryKeyboardAction.LABEL },
	group: 'query',
	when: ContextKeyEqualsExpr.create('activeEditor', 'workbench.editor.queryEditor')
});

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		RunCurrentQueryKeyboardAction,
		RunCurrentQueryKeyboardAction.ID,
		RunCurrentQueryKeyboardAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.F5 }
	),
	RunCurrentQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		RunCurrentQueryWithActualPlanKeyboardAction,
		RunCurrentQueryWithActualPlanKeyboardAction.ID,
		RunCurrentQueryWithActualPlanKeyboardAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.KEY_M }
	),
	RunCurrentQueryWithActualPlanKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		CancelQueryKeyboardAction,
		CancelQueryKeyboardAction.ID,
		CancelQueryKeyboardAction.LABEL,
		{ primary: KeyMod.Alt | KeyCode.PauseBreak }
	),
	CancelQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		RefreshIntellisenseKeyboardAction,
		RefreshIntellisenseKeyboardAction.ID,
		RefreshIntellisenseKeyboardAction.LABEL
	),
	RefreshIntellisenseKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		FocusOnCurrentQueryKeyboardAction,
		FocusOnCurrentQueryKeyboardAction.ID,
		FocusOnCurrentQueryKeyboardAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_O }
	),
	FocusOnCurrentQueryKeyboardAction.LABEL
);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		ParseSyntaxAction,
		ParseSyntaxAction.ID,
		ParseSyntaxAction.LABEL
	),
	ParseSyntaxAction.LABEL
);

// Grid actions

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		ToggleQueryResultsKeyboardAction,
		ToggleQueryResultsKeyboardAction.ID,
		ToggleQueryResultsKeyboardAction.LABEL,
		{ primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KEY_R },
		QueryEditorVisibleCondition
	),
	ToggleQueryResultsKeyboardAction.LABEL
);

// Register Flavor Action
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		ChangeFlavorAction,
		ChangeFlavorAction.ID,
		ChangeFlavorAction.LABEL
	),
	'Change Language Flavor'
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

export const queryEditorConfigurationBaseNode = Object.freeze<IConfigurationNode>({
	id: 'queryEditor',
	order: 5,
	type: 'object',
	title: localize('queryEditorConfigurationTitle', "Query Editor"),
});

// Intellisense and other configuration options
const queryEditorConfiguration: IConfigurationNode = {
	...queryEditorConfigurationBaseNode,
	properties: {
		'queryEditor.results.saveAsCsv.includeHeaders': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsCsv.includeHeaders', "When true, column headers are included when saving results as CSV"),
			'default': true
		},
		'queryEditor.results.saveAsCsv.delimiter': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsCsv.delimiter', "The custom delimiter to use between values when saving as CSV"),
			'default': ','
		},
		'queryEditor.results.saveAsCsv.lineSeperator': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsCsv.lineSeperator', "Character(s) used for seperating rows when saving results as CSV"),
			'default': null
		},
		'queryEditor.results.saveAsCsv.textIdentifier': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsCsv.textIdentifier', "Character used for enclosing text fields when saving results as CSV"),
			'default': '\"'
		},
		'queryEditor.results.saveAsCsv.encoding': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsCsv.encoding', "File encoding used when saving results as CSV"),
			'default': 'utf-8'
		},
		'queryEditor.results.saveAsXml.formatted': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsXml.formatted', "When true, XML output will be formatted when saving results as XML"),
			'default': true
		},
		'queryEditor.results.saveAsXml.encoding': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsXml.encoding', "File encoding used when saving results as XML"),
			'default': 'utf-8'
		},
		'queryEditor.results.streaming': {
			'type': 'boolean',
			'description': localize('queryEditor.results.streaming', "Enable results streaming; contains few minor visual issues"),
			'default': true
		},
		'queryEditor.results.copyIncludeHeaders': {
			'type': 'boolean',
			'description': localize('queryEditor.results.copyIncludeHeaders', "Configuration options for copying results from the Results View"),
			'default': false
		},
		'queryEditor.results.copyRemoveNewLine': {
			'type': 'boolean',
			'description': localize('queryEditor.results.copyRemoveNewLine', "Configuration options for copying multi-line results from the Results View"),
			'default': true
		},
		'queryEditor.messages.showBatchTime': {
			'type': 'boolean',
			'description': localize('queryEditor.messages.showBatchTime', "Should execution time be shown for individual batches"),
			'default': false
		},
		'queryEditor.messages.wordwrap': {
			'type': 'boolean',
			'description': localize('queryEditor.messages.wordwrap', "Word wrap messages"),
			'default': true
		},
		'queryEditor.chart.defaultChartType': {
			'type': 'string',
			'enum': ['bar', 'doughnut', 'horizontalBar', 'line', 'pie', 'scatter', 'timeSeries'],
			'default': 'horizontalBar',
			'description': localize('queryEditor.chart.defaultChartType', "The default chart type to use when opening Chart Viewer from a Query Results")
		},
		'queryEditor.tabColorMode': {
			'type': 'string',
			'enum': ['off', 'border', 'fill'],
			'enumDescriptions': [
				localize('queryEditor.tabColorMode.off', "Tab coloring will be disabled"),
				localize('queryEditor.tabColorMode.border', "The top border of each editor tab will be colored to match the relevant server group"),
				localize('queryEditor.tabColorMode.fill', "Each editor tab's background color will match the relevant server group"),
			],
			'default': 'off',
			'description': localize('queryEditor.tabColorMode', "Controls how to color tabs based on the server group of their active connection")
		},
		'queryEditor.showConnectionInfoInTitle': {
			'type': 'boolean',
			'description': localize('queryEditor.showConnectionInfoInTitle', "Controls whether to show the connection info for a tab in the title."),
			'default': true
		},
		'queryEditor.promptToSaveGeneratedFiles': {
			'type': 'boolean',
			'default': false,
			'description': localize('queryEditor.promptToSaveGeneratedFiles', "Prompt to save generated SQL files")
		}
	}
};

// Setup keybindings
const initialShortcuts = [
	{ name: 'sp_help', primary: KeyMod.Alt + KeyCode.F2 },
	// Note: using Ctrl+Shift+N since Ctrl+N is used for "open editor at index" by default. This means it's different from SSMS
	{ name: 'sp_who', primary: KeyMod.WinCtrl + KeyMod.Shift + KeyCode.KEY_1 },
	{ name: 'sp_lock', primary: KeyMod.WinCtrl + KeyMod.Shift + KeyCode.KEY_2 }
];

const shortCutConfiguration: IConfigurationNode = {
	...queryEditorConfigurationBaseNode
};

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
	shortCutConfiguration[settingKey] = {
		'type': 'string',
		'default': defaultVal,
		'description': localize('queryShortcutDescription',
			"Set keybinding workbench.action.query.shortcut{0} to run the shortcut text as a procedure call. Any selected text in the query editor will be passed as a parameter",
			queryIndex)
	};
}

// Register the query-related configuration options
const configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration(queryEditorConfiguration);
configurationRegistry.registerConfiguration(shortCutConfiguration);

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

workbenchRegistry.registerWorkbenchContribution(TimeElapsedStatusBarContributions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(RowCountStatusBarContributions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(QueryStatusStatusBarContributions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(SqlFlavorStatusbarItem, LifecyclePhase.Restored);
