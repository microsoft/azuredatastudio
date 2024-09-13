/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IConfigurationRegistry, Extensions as ConfigExtensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { MenuId, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode, KeyChord } from 'vs/base/common/keyCodes';
import * as platform from 'vs/base/common/platform';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ContextKeyExpr, ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';

import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryResultsEditor } from 'sql/workbench/contrib/query/browser/queryResultsEditor';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import * as queryContext from 'sql/workbench/contrib/query/common/queryContext';
import {
	RunQueryKeyboardAction, RunCurrentQueryKeyboardAction, CancelQueryKeyboardAction, RefreshIntellisenseKeyboardAction, ToggleQueryResultsKeyboardAction,
	RunQueryShortcutAction, ToggleActualPlanKeyboardAction, CopyQueryWithResultsKeyboardAction, FocusOnCurrentQueryKeyboardAction, ParseSyntaxAction, ToggleFocusBetweenQueryEditorAndResultsAction, EstimatedExecutionPlanKeyboardAction
} from 'sql/workbench/contrib/query/browser/keyboardQueryActions';
import { localize } from 'vs/nls';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';

import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { TimeElapsedStatusBarContributions, RowCountStatusBarContributions, QueryStatusStatusBarContributions, QueryResultSelectionSummaryStatusBarContribution } from 'sql/workbench/contrib/query/browser/statusBarItems';
import { SqlFlavorStatusbarItem, ChangeFlavorAction } from 'sql/workbench/contrib/query/browser/flavorStatus';
import { EditorExtensions, IEditorFactoryRegistry } from 'vs/workbench/common/editor';
import { FileQueryEditorInput } from 'sql/workbench/browser/editor/query/fileQueryEditorInput';
import { FileQueryEditorSerializer, QueryEditorLanguageAssociation, UntitledQueryEditorSerializer } from 'sql/workbench/contrib/query/browser/queryEditorFactory';
import { UntitledQueryEditorInput } from 'sql/workbench/browser/editor/query/untitledQueryEditorInput';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { NewQueryTask, OE_NEW_QUERY_ACTION_ID, DE_NEW_QUERY_COMMAND_ID } from 'sql/workbench/contrib/query/browser/queryActions';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { IEditorResolverService, RegisteredEditorPriority } from 'vs/workbench/services/editor/common/editorResolverService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ILogService } from 'vs/platform/log/common/log';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IComponentContextService } from 'sql/workbench/services/componentContext/browser/componentContextService';
import { CopyHeadersAction, CopyResultAction, SaveResultAction } from 'sql/workbench/contrib/query/browser/actions';
import { InQueryResultGridContextKey } from 'sql/workbench/services/componentContext/browser/contextKeys';

export const QueryEditorVisibleCondition = ContextKeyExpr.has(queryContext.queryEditorVisibleId);
export const ResultsGridFocusCondition = ContextKeyExpr.and(ContextKeyExpr.has(queryContext.resultsVisibleId), ContextKeyExpr.has(queryContext.resultsGridFocussedId));
export const ResultsMessagesFocusCondition = ContextKeyExpr.and(ContextKeyExpr.has(queryContext.resultsVisibleId), ContextKeyExpr.has(queryContext.resultsMessagesFocussedId));

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(FileQueryEditorInput.ID, FileQueryEditorSerializer);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(UntitledQueryEditorInput.ID, UntitledQueryEditorSerializer);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation(QueryEditorLanguageAssociation.languages, QueryEditorLanguageAssociation, QueryEditorLanguageAssociation.isDefault);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(EditorPaneDescriptor.create(QueryResultsEditor, QueryResultsEditor.ID, localize('queryResultsEditor.name', "Query Results")), [new SyncDescriptor(QueryResultsInput)]);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(EditorPaneDescriptor.create(QueryEditor, QueryEditor.ID, QueryEditor.LABEL), [new SyncDescriptor(FileQueryEditorInput), new SyncDescriptor(UntitledQueryEditorInput)]);

new NewQueryTask().registerTask();

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 0,
	command: {
		id: OE_NEW_QUERY_ACTION_ID,
		title: localize('newQuery', "New Query")
	},
	when: ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.IsQueryProvider.isEqualTo(true), ContextKeyExpr.or(TreeNodeContextKey.NodeType.isEqualTo('Server'), TreeNodeContextKey.NodeType.isEqualTo('Database')))
});

// New Query
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: '0_query',
	order: 0,
	command: {
		id: DE_NEW_QUERY_COMMAND_ID,
		title: localize('newQuery', "New Query")
	},
	when: ContextKeyExpr.and(MssqlNodeContext.IsDatabaseOrServer, MssqlNodeContext.IsQueryProvider)
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
registerAction2(RunQueryKeyboardAction);

// Only show Run Query if the active editor is a query editor.
MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
	command: { id: RunQueryKeyboardAction.ID, title: RunQueryKeyboardAction.LABEL },
	group: 'query',
	when: ContextKeyEqualsExpr.create('activeEditor', 'workbench.editor.queryEditor')
});

registerAction2(RunCurrentQueryKeyboardAction);

registerAction2(EstimatedExecutionPlanKeyboardAction);

registerAction2(ToggleActualPlanKeyboardAction);

registerAction2(CopyQueryWithResultsKeyboardAction);

registerAction2(CancelQueryKeyboardAction);

registerAction2(RefreshIntellisenseKeyboardAction);

registerAction2(FocusOnCurrentQueryKeyboardAction);

registerAction2(ParseSyntaxAction);

// Grid actions

registerAction2(ToggleQueryResultsKeyboardAction);

registerAction2(ToggleFocusBetweenQueryEditorAndResultsAction);

// Register Flavor Action
registerAction2(ChangeFlavorAction);

const GridKeyBindingWeight = 900;

function executeActionOnQueryResultGrid(accessor: ServicesAccessor, actionId: string) {
	const componentContextService = accessor.get(IComponentContextService);
	const activeGrid = componentContextService.getActiveQueryResultGrid();
	if (activeGrid) {
		activeGrid.runAction(actionId);
	}
}

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: CopyResultAction.COPYWITHHEADERS_ID,
	weight: GridKeyBindingWeight,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
	when: InQueryResultGridContextKey,
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, CopyResultAction.COPYWITHHEADERS_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: CopyHeadersAction.ID,
	weight: GridKeyBindingWeight,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyH,
	when: InQueryResultGridContextKey,
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, CopyHeadersAction.ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SaveResultAction.SAVECSV_ID,
	weight: GridKeyBindingWeight,
	when: InQueryResultGridContextKey,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyC),
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, SaveResultAction.SAVECSV_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SaveResultAction.SAVEJSON_ID,
	weight: GridKeyBindingWeight,
	when: InQueryResultGridContextKey,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyJ),
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, SaveResultAction.SAVEJSON_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SaveResultAction.SAVEMARKDOWN_ID,
	weight: GridKeyBindingWeight,
	when: InQueryResultGridContextKey,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyM),
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, SaveResultAction.SAVEMARKDOWN_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SaveResultAction.SAVEEXCEL_ID,
	weight: GridKeyBindingWeight,
	when: InQueryResultGridContextKey,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyE),
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, SaveResultAction.SAVEEXCEL_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SaveResultAction.SAVEXML_ID,
	weight: GridKeyBindingWeight,
	when: InQueryResultGridContextKey,
	primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyX),
	handler: (accessor) => {
		executeActionOnQueryResultGrid(accessor, SaveResultAction.SAVEXML_ID);
	}
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
		'queryEditor.results.saveAsExcel.includeHeaders': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsExcel.includeHeaders', "When true, column headers are included when saving results as an Excel file"),
			'default': true
		},
		'queryEditor.results.saveAsExcel.freezeHeaderRow': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsExcel.freezeHeaderRow', "When true, freeze the header row when saving results as an Excel file"),
			'default': false
		},
		'queryEditor.results.saveAsExcel.autoFilterHeaderRow': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsExcel.autoFilterHeaderRow', "When true, enable auto filtering on the header row when saving results as an Excel file"),
			'default': false
		},
		'queryEditor.results.saveAsExcel.autoSizeColumns': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsExcel.autoSizeColumns', "When true, attempt to automatically size columns when saving results as an Excel file"),
			'default': false
		},
		'queryEditor.results.saveAsExcel.boldHeaderRow': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsExcel.boldHeaderRow', "When true, make the header row bold when saving results as an Excel file"),
			'default': false
		},
		'queryEditor.results.saveAsCsv.encoding': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsCsv.encoding', "File encoding used when saving results as CSV"),
			'default': 'utf-8'
		},
		'queryEditor.results.saveAsMarkdown.encoding': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsMarkdown.encoding', "File encoding used when saving results as Markdown"),
			'default': 'utf-8'
		},
		'queryEditor.results.saveAsMarkdown.includeHeaders': {
			'type': 'boolean',
			'description': localize('queryEditor.results.saveAsMarkdown.includeHeaders', "When true, column headers are included when saving results as a Markdown file"),
			'default': true
		},
		'queryEditor.results.saveAsMarkdown.lineSeparator': {
			'type': 'string',
			'description': localize('queryEditor.results.saveAsMarkdown.lineSeparator', "Character(s) to use to separate lines when exporting to Markdown, defaults to system line endings"),
			'default': null
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
		'queryEditor.results.showCopyCompletedNotification': {
			'type': 'boolean',
			'description': localize('queryEditor.results.showCopyCompletedNotification', "Whether to show notifications when a results grid copy operation is completed."),
			'default': true
		},
		'queryEditor.results.skipNewLineAfterTrailingLineBreak': {
			'type': 'boolean',
			'description': localize('queryEditor.results.skipNewLineAfterTrailingLineBreak', "Whether to skip adding a line break between rows when copying results if the previous row already has a trailing line break. The default value is false."),
			'default': false
		},
		'queryEditor.results.preferProvidersCopyHandler': {
			'type': 'boolean',
			'description': localize('queryEditor.results.preferProvidersCopyHandler', "Whether the copy result request should be handled by the query provider when it is supported. The default value is true for Windows and Mac, and false for Linux, set this to false to force all copy handling to be done by Azure Data Studio."),
			'default': platform.isLinux ? false : true
		},
		'queryEditor.results.inMemoryDataProcessingThreshold': {
			'type': 'number',
			'default': 5000,
			'description': localize('queryEditor.inMemoryDataProcessingThreshold', "Controls the max number of rows allowed to do filtering and sorting in memory. If the number is exceeded, sorting and filtering will be disabled. Warning: Increasing this may impact performance.")
		},
		'queryEditor.results.openAfterSave': {
			'type': 'boolean',
			'description': localize('queryEditor.results.openAfterSave', "Whether to open the file in Azure Data Studio after the result is saved."),
			'default': true
		},
		'queryEditor.results.showActionBar': {
			'type': 'boolean',
			'description': localize('queryEditor.results.showActionBar', "Whether to show the action bar in the query results view"),
			'default': true
		},
		'queryEditor.results.promptForLargeRowSelection': {
			'type': 'boolean',
			'default': true,
			'description': localize('queryEditor.results.promptForLargeRowSelection', "When cells are selected in the results grid, ADS will calculate the summary for them, This setting controls whether to show the a confirmation when the number of rows selected is larger than the value specified in the 'inMemoryDataProcessingThreshold' setting. The default value is true.")
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
		},
		'queryEditor.githubCopilotContextualizationEnabled': {
			'type': 'boolean',
			'default': false,
			'description': localize('queryEditor.githubCopilotContextualizationEnabled', "(Preview) Enable contextualization of queries for GitHub Copilot. This setting helps GitHub Copilot to return improved suggestions, if the Copilot extension is installed and providers have implemented contextualization.")
		}
	}
};

// Setup keybindings
const initialShortcuts = [
	{ name: 'sp_help', primary: KeyMod.Alt + KeyCode.F2 },
	// Note: using Ctrl+Shift+N since Ctrl+N is used for "open editor at index" by default. This means it's different from SSMS
	{ name: 'sp_who', primary: KeyMod.WinCtrl + KeyMod.Shift + KeyCode.Digit1 },
	{ name: 'sp_lock', primary: KeyMod.WinCtrl + KeyMod.Shift + KeyCode.Digit2 }
];

const shortCutConfiguration: IConfigurationNode = {
	...queryEditorConfigurationBaseNode,
	properties: {}
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
	shortCutConfiguration.properties[settingKey] = {
		'type': 'string',
		'default': defaultVal,
		'description': localize('queryShortcutDescription',
			"Set keybinding workbench.action.query.shortcut{0} to run the shortcut text as a procedure call or query execution. Any selected text in the query editor will be passed as a parameter at the end of your query, or you can reference it with {arg}",
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
workbenchRegistry.registerWorkbenchContribution(QueryResultSelectionSummaryStatusBarContribution, LifecyclePhase.Restored);

const languageAssociationRegistry = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

export class QueryEditorOverrideContribution extends Disposable implements IWorkbenchContribution {
	private _registeredOverrides = new DisposableStore();

	constructor(
		@ILogService private _logService: ILogService,
		@IEditorService private _editorService: IEditorService,
		@IEditorResolverService private _editorResolverService: IEditorResolverService,
		@ILanguageService private _languageService: ILanguageService
	) {
		super();
		this.registerEditorOverrides();
		// Refresh the editor overrides whenever the languages change so we ensure we always have
		// the latest up to date list of extensions for each language
		this._languageService.onDidChange(() => {
			this.registerEditorOverrides();
		});
	}

	private registerEditorOverrides(): void {
		this._registeredOverrides.clear();
		// List of language IDs to associate the query editor for. These are case sensitive.
		QueryEditorLanguageAssociation.languages.map(lang => {
			const langExtensions = this._languageService.getExtensions(lang);
			if (langExtensions.length === 0) {
				return;
			}
			// Create the selector from the list of all the language extensions we want to associate with the
			// query editor (filtering out any languages which didn't have any extensions registered yet)
			const selector = `*{${langExtensions.join(',')}}`;
			this._registeredOverrides.add(this._editorResolverService.registerEditor(
				selector,
				{
					id: QueryEditor.ID,
					label: QueryEditor.LABEL,
					priority: RegisteredEditorPriority.builtin
				},
				{
					// Fall back to using the normal text based diff editor - we don't want the query bar and related items showing up in the diff editor
					// canHandleDiff: () => false
				},
				{
					createEditorInput: async (editorInput, group) => {
						const fileInput = await this._editorService.createEditorInput(editorInput) as FileEditorInput;
						const langAssociation = languageAssociationRegistry.getAssociationForLanguage(lang);
						const queryEditorInput = langAssociation?.syncConvertInput?.(fileInput);
						if (!queryEditorInput) {
							this._logService.warn('Unable to create input for resolving editor ', editorInput.resource);
							return undefined;
						}
						return { editor: queryEditorInput, options: editorInput.options, group: group };
					}
				}
			));
		});
	}
}
workbenchRegistry.registerWorkbenchContribution(QueryEditorOverrideContribution, LifecyclePhase.Starting);
