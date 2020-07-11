/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { IEditorInputFactoryRegistry, Extensions as EditorInputFactoryExtensions, ActiveEditorContext } from 'vs/workbench/common/editor';

import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { FileNoteBookEditorInputFactory, UntitledNoteBookEditorInputFactory, NotebookEditorInputAssociation } from 'sql/workbench/contrib/notebook/browser/models/nodebookInputFactory';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionsExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor, registerAction2, MenuRegistry, MenuId, Action2 } from 'vs/platform/actions/common/actions';

import { NotebookEditor } from 'sql/workbench/contrib/notebook/browser/notebookEditor';
import { NewNotebookAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { IConfigurationRegistry, Extensions as ConfigExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { GridOutputComponent } from 'sql/workbench/contrib/notebook/browser/outputs/gridOutput.component';
import { PlotlyOutputComponent } from 'sql/workbench/contrib/notebook/browser/outputs/plotlyOutput.component';
import { registerComponentType } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import { MimeRendererComponent } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRenderer.component';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { URI } from 'vs/base/common/uri';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspaces/common/workspaceEditing';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/browser/parts/views/nodeContext';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ConnectedContext } from 'azdata';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { MarkdownOutputComponent } from 'sql/workbench/contrib/notebook/browser/outputs/markdownOutput.component';
import { registerCellComponent } from 'sql/platform/notebooks/common/outputRegistry';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { NotebookThemingContribution } from 'sql/workbench/contrib/notebook/browser/notebookThemingContribution';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { ToggleTabFocusModeAction } from 'vs/editor/contrib/toggleTabFocusMode/toggleTabFocusMode';
import { NotebookExplorerViewletViewsContribution, OpenNotebookExplorerViewletAction } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookExplorerViewlet';
import 'vs/css!./media/notebook.contribution';
import { isMacintosh } from 'vs/base/common/platform';
import { SearchSortOrder } from 'vs/workbench/services/search/common/search';

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(FileNotebookInput.ID, FileNoteBookEditorInputFactory);

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(UntitledNotebookInput.ID, UntitledNoteBookEditorInputFactory);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation(NotebookEditorInputAssociation.languages, NotebookEditorInputAssociation);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(EditorDescriptor.create(NotebookEditor, NotebookEditor.ID, localize('notebookEditor.name', "Notebook Editor")), [new SyncDescriptor(UntitledNotebookInput), new SyncDescriptor(FileNotebookInput)]);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(NotebookThemingContribution, LifecyclePhase.Restored);

// Global Actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionsExtensions.WorkbenchActions);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		NewNotebookAction,
		NewNotebookAction.ID,
		NewNotebookAction.LABEL,
		{ primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KEY_N },

	),
	NewNotebookAction.LABEL
);

const DE_NEW_NOTEBOOK_COMMAND_ID = 'dataExplorer.newNotebook';
// New Notebook
CommandsRegistry.registerCommand({
	id: DE_NEW_NOTEBOOK_COMMAND_ID,
	handler: (accessor, args: TreeViewItemHandleArg) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectedContext: ConnectedContext = { connectionProfile: args.$treeItem.payload };
		return instantiationService.createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run({ connectionProfile: connectedContext.connectionProfile, isConnectionNode: false, nodeInfo: undefined });
	}
});

// New Notebook
MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: '0_query',
	order: 3,
	command: {
		id: DE_NEW_NOTEBOOK_COMMAND_ID,
		title: localize('newNotebook', "New Notebook")
	},
	when: ContextKeyExpr.and(NodeContextKey.IsConnectable,
		MssqlNodeContext.IsDatabaseOrServer,
		MssqlNodeContext.NodeProvider.isEqualTo(mssqlProviderName))
});

const OE_NEW_NOTEBOOK_COMMAND_ID = 'objectExplorer.newNotebook';
// New Notebook
CommandsRegistry.registerCommand({
	id: OE_NEW_NOTEBOOK_COMMAND_ID,
	handler: (accessor, actionContext: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		return instantiationService.createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run(actionContext);
	}
});

MenuRegistry.appendMenuItem(MenuId.ObjectExplorerItemContext, {
	group: '0_query',
	order: 3,
	command: {
		id: OE_NEW_NOTEBOOK_COMMAND_ID,
		title: localize('newQuery', "New Notebook")
	},
	when: ContextKeyExpr.or(ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.NodeType.isEqualTo('Server')), ContextKeyExpr.and(TreeNodeContextKey.Status.notEqualsTo('Unavailable'), TreeNodeContextKey.NodeType.isEqualTo('Database')))
});

const ExplorerNotebookActionID = 'explorer.notebook';
CommandsRegistry.registerCommand(ExplorerNotebookActionID, (accessor, context: ManageActionContext) => {
	const instantiationService = accessor.get(IInstantiationService);
	const connectedContext: ConnectedContext = { connectionProfile: context.profile };
	instantiationService.createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run({ connectionProfile: connectedContext.connectionProfile, isConnectionNode: false, nodeInfo: undefined });
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerNotebookActionID,
		title: NewNotebookAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});

const TOGGLE_TAB_FOCUS_COMMAND_ID = 'notebook.action.toggleTabFocusMode';
const toggleTabFocusAction = new ToggleTabFocusModeAction();

CommandsRegistry.registerCommand({
	id: TOGGLE_TAB_FOCUS_COMMAND_ID,
	handler: (accessor) => {
		toggleTabFocusAction.run(accessor, undefined);
	}
});


MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: TOGGLE_TAB_FOCUS_COMMAND_ID,
		title: toggleTabFocusAction.label,
	},
	when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookEditor.ID))
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.setWorkspaceAndOpen',
			title: localize('workbench.action.setWorkspaceAndOpen', "Set Workspace And Open")
		});
	}

	run = async (accessor, options: { forceNewWindow: boolean, folderPath: URI }) => {
		const viewletService = accessor.get(IViewletService);
		const workspaceEditingService = accessor.get(IWorkspaceEditingService);
		const hostService = accessor.get(IHostService);
		let folders = [];
		if (!options.folderPath) {
			return;
		}
		folders.push(options.folderPath);
		await workspaceEditingService.addFolders(folders.map(folder => ({ uri: folder })));
		await viewletService.openViewlet(viewletService.getDefaultViewletId(), true);
		if (options.forceNewWindow) {
			return hostService.openWindow([{ folderUri: folders[0] }], { forceNewWindow: options.forceNewWindow });
		}
		else {
			return hostService.reload();
		}
	};
});

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'notebook',
	'title': 'Notebook',
	'type': 'object',
	'properties': {
		'notebook.sqlStopOnError': {
			'type': 'boolean',
			'default': true,
			'description': localize('notebook.sqlStopOnError', "SQL kernel: stop Notebook execution when error occurs in a cell.")
		}
	}
});

configurationRegistry.registerConfiguration({
	'id': 'notebook',
	'title': 'Notebook',
	'type': 'object',
	'properties': {
		'notebook.showAllKernels': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.showAllKernels', "(Preview) show all kernels for the current notebook provider.")
		}
	}
});

configurationRegistry.registerConfiguration({
	'id': 'notebook',
	'title': 'Notebook',
	'type': 'object',
	'properties': {
		'notebook.allowAzureDataStudioCommands': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.allowADSCommands', "Allow notebooks to run Azure Data Studio commands.")
		}
	}
});

/* *************** Output components *************** */
// Note: most existing types use the same component to render. In order to
// preserve correct rank order, we register it once for each different rank of
// MIME types.

/**
 * A mime renderer component for raw html.
 */
registerComponentType({
	mimeTypes: ['text/html'],
	rank: 50,
	safe: true,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A mime renderer component for images.
 */
registerComponentType({
	mimeTypes: ['image/bmp', 'image/png', 'image/jpeg', 'image/gif'],
	rank: 90,
	safe: true,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A mime renderer component for svg.
 */
registerComponentType({
	mimeTypes: ['image/svg+xml'],
	rank: 80,
	safe: false,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A mime renderer component for plain and jupyter console text data.
 */
registerComponentType({
	mimeTypes: [
		'text/plain',
		'application/vnd.jupyter.stdout',
		'application/vnd.jupyter.stderr'
	],
	rank: 120,
	safe: true,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A placeholder component for deprecated rendered JavaScript.
 */
registerComponentType({
	mimeTypes: ['text/javascript', 'application/javascript'],
	rank: 110,
	safe: false,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A mime renderer component for grid data.
 * This will be replaced by a dedicated component in the future
 */
registerComponentType({
	mimeTypes: [
		'application/vnd.dataresource+json',
		'application/vnd.dataresource'
	],
	rank: 40,
	safe: true,
	ctor: GridOutputComponent,
	selector: GridOutputComponent.SELECTOR
});

/**
 * A mime renderer component for LaTeX.
 */
registerComponentType({
	mimeTypes: ['text/latex'],
	rank: 70,
	safe: true,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A mime renderer component for Plotly graphs.
 */
registerComponentType({
	mimeTypes: ['application/vnd.plotly.v1+json'],
	rank: 45,
	safe: true,
	ctor: PlotlyOutputComponent,
	selector: PlotlyOutputComponent.SELECTOR
});
/**
 * A mime renderer component for Plotly HTML output
 * that will ensure this gets ignored if possible since it's only output
 * on offline init and adds a <script> tag which does what we've done (add Plotly support into the app)
 */
registerComponentType({
	mimeTypes: ['text/vnd.plotly.v1+html'],
	rank: 46,
	safe: true,
	ctor: PlotlyOutputComponent,
	selector: PlotlyOutputComponent.SELECTOR
});

/**
 * A mime renderer component for Markdown.
 */
registerComponentType({
	mimeTypes: ['text/markdown'],
	rank: 60,
	safe: true,
	ctor: MarkdownOutputComponent,
	selector: MarkdownOutputComponent.SELECTOR
});

/**
 * A mime renderer for IPyWidgets
 */
registerComponentType({
	mimeTypes: [
		'application/vnd.jupyter.widget-view',
		'application/vnd.jupyter.widget-view+json'
	],
	rank: 47,
	safe: true,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});
registerCellComponent(TextCellComponent);

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(NotebookExplorerViewletViewsContribution, LifecyclePhase.Starting);
const registry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionsExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		OpenNotebookExplorerViewletAction,
		OpenNotebookExplorerViewletAction.ID,
		OpenNotebookExplorerViewletAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_B }),
	'View: Show Notebook Explorer',
	localize('notebookExplorer.view', "View")
);

// Configuration
configurationRegistry.registerConfiguration({
	id: 'notebookExplorerSearch',
	order: 13,
	title: localize('searchConfigurationTitle', "Search Notebooks"),
	type: 'object',
	properties: {
		'notebookExplorerSearch.exclude': {
			type: 'object',
			markdownDescription: localize('exclude', "Configure glob patterns for excluding files and folders in fulltext searches and quick open. Inherits all glob patterns from the `#files.exclude#` setting. Read more about glob patterns [here](https://code.visualstudio.com/docs/editor/codebasics#_advanced-search-options)."),
			default: { '**/node_modules': true, '**/bower_components': true, '**/*.code-search': true },
			additionalProperties: {
				anyOf: [
					{
						type: 'boolean',
						description: localize('exclude.boolean', "The glob pattern to match file paths against. Set to true or false to enable or disable the pattern."),
					},
					{
						type: 'object',
						properties: {
							when: {
								type: 'string',
								pattern: '\\w*\\$\\(basename\\)\\w*',
								default: '$(basename).ext',
								description: localize('exclude.when', 'Additional check on the siblings of a matching file. Use $(basename) as variable for the matching file name.')
							}
						}
					}
				]
			},
			scope: ConfigurationScope.RESOURCE
		},
		'notebookExplorerSearch.useRipgrep': {
			type: 'boolean',
			description: localize('useRipgrep', "This setting is deprecated and now falls back on \"search.usePCRE2\"."),
			deprecationMessage: localize('useRipgrepDeprecated', "Deprecated. Consider \"search.usePCRE2\" for advanced regex feature support."),
			default: true
		},
		'notebookExplorerSearch.maintainFileSearchCache': {
			type: 'boolean',
			description: localize('search.maintainFileSearchCache', "When enabled, the searchService process will be kept alive instead of being shut down after an hour of inactivity. This will keep the file search cache in memory."),
			default: false
		},
		'notebookExplorerSearch.useIgnoreFiles': {
			type: 'boolean',
			markdownDescription: localize('useIgnoreFiles', "Controls whether to use `.gitignore` and `.ignore` files when searching for files."),
			default: true,
			scope: ConfigurationScope.RESOURCE
		},
		'notebookExplorerSearch.useGlobalIgnoreFiles': {
			type: 'boolean',
			markdownDescription: localize('useGlobalIgnoreFiles', "Controls whether to use global `.gitignore` and `.ignore` files when searching for files."),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'notebookExplorerSearch.quickOpen.includeSymbols': {
			type: 'boolean',
			description: localize('search.quickOpen.includeSymbols', "Whether to include results from a global symbol search in the file results for Quick Open."),
			default: false
		},
		'notebookExplorerSearch.quickOpen.includeHistory': {
			type: 'boolean',
			description: localize('search.quickOpen.includeHistory', "Whether to include results from recently opened files in the file results for Quick Open."),
			default: true
		},
		'notebookExplorerSearch.quickOpen.history.filterSortOrder': {
			'type': 'string',
			'enum': ['default', 'recency'],
			'default': 'default',
			'enumDescriptions': [
				localize('filterSortOrder.default', 'History entries are sorted by relevance based on the filter value used. More relevant entries appear first.'),
				localize('filterSortOrder.recency', 'History entries are sorted by recency. More recently opened entries appear first.')
			],
			'description': localize('filterSortOrder', "Controls sorting order of editor history in quick open when filtering.")
		},
		'notebookExplorerSearch.followSymlinks': {
			type: 'boolean',
			description: localize('search.followSymlinks', "Controls whether to follow symlinks while searching."),
			default: true
		},
		'notebookExplorerSearch.smartCase': {
			type: 'boolean',
			description: localize('search.smartCase', "Search case-insensitively if the pattern is all lowercase, otherwise, search case-sensitively."),
			default: false
		},
		'notebookExplorerSearch.globalFindClipboard': {
			type: 'boolean',
			default: false,
			description: localize('search.globalFindClipboard', "Controls whether the search view should read or modify the shared find clipboard on macOS."),
			included: isMacintosh
		},
		'notebookExplorerSearch.location': {
			type: 'string',
			enum: ['sidebar', 'panel'],
			default: 'sidebar',
			description: localize('search.location', "Controls whether the search will be shown as a view in the sidebar or as a panel in the panel area for more horizontal space."),
			deprecationMessage: localize('search.location.deprecationMessage', "This setting is deprecated. Please use the search view's context menu instead.")
		},
		'notebookExplorerSearch.collapseResults': {
			type: 'string',
			enum: ['auto', 'alwaysCollapse', 'alwaysExpand'],
			enumDescriptions: [
				localize('search.collapseResults.auto', "Files with less than 10 results are expanded. Others are collapsed."),
				'',
				''
			],
			default: 'alwaysExpand',
			description: localize('search.collapseAllResults', "Controls whether the search results will be collapsed or expanded."),
		},
		'notebookExplorerSearch.useReplacePreview': {
			type: 'boolean',
			default: true,
			description: localize('search.useReplacePreview', "Controls whether to open Replace Preview when selecting or replacing a match."),
		},
		'notebookExplorerSearch.showLineNumbers': {
			type: 'boolean',
			default: false,
			description: localize('search.showLineNumbers', "Controls whether to show line numbers for search results."),
		},
		'notebookExplorerSearch.usePCRE2': {
			type: 'boolean',
			default: false,
			description: localize('search.usePCRE2', "Whether to use the PCRE2 regex engine in text search. This enables using some advanced regex features like lookahead and backreferences. However, not all PCRE2 features are supported - only features that are also supported by JavaScript."),
			deprecationMessage: localize('usePCRE2Deprecated', "Deprecated. PCRE2 will be used automatically when using regex features that are only supported by PCRE2."),
		},
		'notebookExplorerSearch.actionsPosition': {
			type: 'string',
			enum: ['auto', 'right'],
			enumDescriptions: [
				localize('search.actionsPositionAuto', "Position the actionbar to the right when the search view is narrow, and immediately after the content when the search view is wide."),
				localize('search.actionsPositionRight', "Always position the actionbar to the right."),
			],
			default: 'auto',
			description: localize('search.actionsPosition', "Controls the positioning of the actionbar on rows in the search view.")
		},
		'notebookExplorerSearch.searchOnType': {
			type: 'boolean',
			default: true,
			description: localize('search.searchOnType', "Search all files as you type.")
		},
		'notebookExplorerSearch.seedWithNearestWord': {
			type: 'boolean',
			default: false,
			description: localize('search.seedWithNearestWord', "Enable seeding search from the word nearest the cursor when the active editor has no selection.")
		},
		'notebookExplorerSearch.seedOnFocus': {
			type: 'boolean',
			default: false,
			description: localize('search.seedOnFocus', "Update workspace search query to the editor's selected text when focusing the search view. This happens either on click or when triggering the `workbench.views.search.focus` command.")
		},
		'notebookExplorerSearch.searchOnTypeDebouncePeriod': {
			type: 'number',
			default: 1000,
			markdownDescription: localize('search.searchOnTypeDebouncePeriod', "When `#search.searchOnType#` is enabled, controls the timeout in milliseconds between a character being typed and the search starting. Has no effect when `search.searchOnType` is disabled.")
		},
		'notebookExplorerSearch.searchEditor.doubleClickBehaviour': {
			type: 'string',
			enum: ['selectWord', 'goToLocation', 'openLocationToSide'],
			default: 'goToLocation',
			enumDescriptions: [
				localize('search.searchEditor.doubleClickBehaviour.selectWord', "Double clicking selects the word under the cursor."),
				localize('search.searchEditor.doubleClickBehaviour.goToLocation', "Double clicking opens the result in the active editor group."),
				localize('search.searchEditor.doubleClickBehaviour.openLocationToSide', "Double clicking opens the result in the editor group to the side, creating one if it does not yet exist."),
			],
			markdownDescription: localize('search.searchEditor.doubleClickBehaviour', "Configure effect of double clicking a result in a search editor.")
		},
		'notebookExplorerSearch.sortOrder': {
			'type': 'string',
			'enum': [SearchSortOrder.Default, SearchSortOrder.FileNames, SearchSortOrder.Type, SearchSortOrder.Modified, SearchSortOrder.CountDescending, SearchSortOrder.CountAscending],
			'default': SearchSortOrder.Default,
			'enumDescriptions': [
				localize('searchSortOrder.default', 'Results are sorted by folder and file names, in alphabetical order.'),
				localize('searchSortOrder.filesOnly', 'Results are sorted by file names ignoring folder order, in alphabetical order.'),
				localize('searchSortOrder.type', 'Results are sorted by file extensions, in alphabetical order.'),
				localize('searchSortOrder.modified', 'Results are sorted by file last modified date, in descending order.'),
				localize('searchSortOrder.countDescending', 'Results are sorted by count per file, in descending order.'),
				localize('searchSortOrder.countAscending', 'Results are sorted by count per file, in ascending order.')
			],
			'description': localize('search.sortOrder', "Controls sorting order of search results.")
		},
	}
});
