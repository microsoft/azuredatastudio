/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry } from 'vs/workbench/browser/editor';

import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { IEditorInputFactoryRegistry, ActiveEditorContext, IEditorInput, EditorExtensions } from 'vs/workbench/common/editor';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { FileNoteBookEditorInputSerializer, NotebookEditorInputAssociation, UntitledNotebookEditorInputSerializer } from 'sql/workbench/contrib/notebook/browser/models/notebookInputFactory';
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
import { NodeContextKey } from 'sql/workbench/contrib/views/browser/nodeContext';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ConnectedContext, nb } from 'azdata';
import { TreeNodeContextKey } from 'sql/workbench/services/objectExplorer/common/treeNodeContextKey';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { MarkdownOutputComponent } from 'sql/workbench/contrib/notebook/browser/outputs/markdownOutput.component';
import { registerCellComponent } from 'sql/platform/notebooks/common/outputRegistry';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { NotebookThemingContribution } from 'sql/workbench/contrib/notebook/browser/notebookThemingContribution';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ToggleTabFocusModeAction } from 'vs/editor/contrib/toggleTabFocusMode/toggleTabFocusMode';
import 'vs/css!./media/notebook.contribution';
import { isMacintosh } from 'vs/base/common/platform';
import { SearchSortOrder } from 'vs/workbench/services/search/common/search';
import { ImageMimeTypes, TextCellEditModes } from 'sql/workbench/services/notebook/common/contracts';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookManager } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookExplorerViewletViewsContribution } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookExplorerViewlet';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { ContributedEditorPriority, IEditorOverrideService } from 'vs/workbench/services/editor/common/editorOverrideService';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ILogService } from 'vs/platform/log/common/log';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { useNewMarkdownRendererKey } from 'sql/workbench/contrib/notebook/common/notebookCommon';

Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories)
	.registerEditorInputSerializer(FileNotebookInput.ID, FileNoteBookEditorInputSerializer);

Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories)
	.registerEditorInputSerializer(UntitledNotebookInput.ID, UntitledNotebookEditorInputSerializer);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation(NotebookEditorInputAssociation.languages, NotebookEditorInputAssociation);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(EditorDescriptor.create(NotebookEditor, NotebookEditor.ID, NotebookEditor.LABEL), [new SyncDescriptor(UntitledNotebookInput), new SyncDescriptor(FileNotebookInput)]);

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

const LAUNCH_FIND_IN_NOTEBOOK = 'notebook.action.launchFindInNotebook';

CommandsRegistry.registerCommand({
	id: LAUNCH_FIND_IN_NOTEBOOK,
	handler: async (accessor: ServicesAccessor, searchTerm: string) => {
		const notebookEditor = accessor.get(IEditorService).activeEditorPane;
		if (notebookEditor instanceof NotebookEditor) {
			if (notebookEditor) {
				await notebookEditor.setNotebookModel();
				await notebookEditor.launchFind(searchTerm);
			}
		}
	}
});

const RESTART_JUPYTER_NOTEBOOK_SESSIONS = 'notebook.action.restartJupyterNotebookSessions';

CommandsRegistry.registerCommand({
	id: RESTART_JUPYTER_NOTEBOOK_SESSIONS,
	handler: async (accessor: ServicesAccessor, restartJupyterServer: boolean = true) => {
		const editorService: IEditorService = accessor.get(IEditorService);
		const editors: readonly IEditorInput[] = editorService.editors;
		let jupyterServerRestarted: boolean = false;

		for (let editor of editors) {
			if (editor instanceof NotebookInput) {
				let model: INotebookModel = editor.notebookModel;
				if (model.providerId === 'jupyter' && model.clientSession.isReady) {
					// Jupyter server needs to be restarted so that the correct Python installation is used
					if (!jupyterServerRestarted && restartJupyterServer) {
						let jupyterNotebookManager: INotebookManager = model.notebookManagers.find(x => x.providerId === 'jupyter');
						// Shutdown all current Jupyter sessions before stopping the server
						await jupyterNotebookManager.sessionManager.shutdownAll();
						// Jupyter session manager needs to be disposed so that a new one is created with the new server info
						jupyterNotebookManager.sessionManager.dispose();
						await jupyterNotebookManager.serverManager.stopServer();
						let spec: nb.IKernelSpec = model.defaultKernel;
						await jupyterNotebookManager.serverManager.startServer(spec);
						jupyterServerRestarted = true;
					}

					// Start a new session for each Jupyter notebook
					await model.restartSession();
				}
			}
		}
	}
});

const STOP_JUPYTER_NOTEBOOK_SESSIONS = 'notebook.action.stopJupyterNotebookSessions';

CommandsRegistry.registerCommand({
	id: STOP_JUPYTER_NOTEBOOK_SESSIONS,
	handler: async (accessor: ServicesAccessor) => {
		const editorService: IEditorService = accessor.get(IEditorService);
		const editors: readonly IEditorInput[] = editorService.editors;

		for (let editor of editors) {
			if (editor instanceof NotebookInput) {
				let model: INotebookModel = editor.notebookModel;
				if (model?.providerId === 'jupyter') {
					let jupyterNotebookManager: INotebookManager = model.notebookManagers.find(x => x.providerId === 'jupyter');
					await jupyterNotebookManager.sessionManager.shutdownAll();
					jupyterNotebookManager.sessionManager.dispose();
					await jupyterNotebookManager.serverManager.stopServer();
					return;
				}
			}
		}
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
		},
		'notebook.showAllKernels': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.showAllKernels', "(Preview) show all kernels for the current notebook provider.")
		},
		'notebook.allowAzureDataStudioCommands': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.allowADSCommands', "Allow notebooks to run Azure Data Studio commands.")
		},
		'notebook.enableDoubleClickEdit': {
			'type': 'boolean',
			'default': true,
			'description': localize('notebook.enableDoubleClickEdit', "Enable double click to edit for text cells in notebooks")
		},
		'notebook.defaultTextEditMode': {
			'type': 'string',
			'enum': [TextCellEditModes.RichText, TextCellEditModes.SplitView, TextCellEditModes.Markdown],
			'enumDescriptions': [
				localize('notebook.richTextModeDescription', 'Text is displayed as Rich Text (also known as WYSIWYG).'),
				localize('notebook.splitViewModeDescription', 'Markdown is displayed on the left, with a preview of the rendered text on the right.'),
				localize('notebook.markdownModeDescription', 'Text is displayed as Markdown.')
			],
			'default': TextCellEditModes.RichText,
			'description': localize('notebook.defaultTextEditMode', "The default editing mode used for text cells")
		},
		'notebook.saveConnectionName': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.saveConnectionName', "(Preview) Save connection name in notebook metadata.")
		},
		'notebook.markdownPreviewLineHeight': {
			'type': 'number',
			'default': 1.5,
			'minimum': 1,
			'description': localize('notebook.markdownPreviewLineHeight', "Controls the line height used in the notebook markdown preview. This number is relative to the font size.")
		},
		'notebook.showRenderedNotebookInDiffEditor': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.showRenderedNotebookinDiffEditor', "(Preview) Show rendered notebook in diff editor.")
		},
		'notebook.maxRichTextUndoHistory': {
			'type': 'number',
			'default': 200,
			'minimum': 10,
			'description': localize('notebook.maxRichTextUndoHistory', "The maximum number of changes stored in the undo history for the notebook Rich Text editor.")
		},
		'notebook.useAbsoluteFilePaths': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.useAbsoluteFilePaths', "Use absolute file paths when linking to other notebooks.")
		},
		'notebook.enableIncrementalGridRendering': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.enableIncrementalGridRendering', "Enable incremental grid rendering for notebooks. This will improve the initial rendering time for large notebooks. There may be performance issues when interacting with the notebook while the rest of the grids are rendering.")
		},
		[useNewMarkdownRendererKey]: {
			'type': 'boolean',
			default: false,
			'description': localize('notebook.useNewMarkdownRenderer', "Whether to use the newer version of the markdown renderer for Notebooks. This may result in markdown being rendered differently than previous versions.")
		}
	}
});

configurationRegistry.registerConfiguration({
	'id': 'notebookViews',
	'title': localize('notebookViews', 'Notebook Views'),
	'type': 'object',
	'properties': {
		'notebookViews.enabled': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebookViews.enabled', "(Preview) Enable Notebook Views")
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
	mimeTypes: ImageMimeTypes,
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

const languageAssociationRegistry = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

export class NotebookEditorOverrideContribution extends Disposable implements IWorkbenchContribution {

	private _registeredOverrides = new DisposableStore();

	constructor(
		@ILogService private _logService: ILogService,
		@IEditorService private _editorService: IEditorService,
		@IEditorOverrideService private _editorOverrideService: IEditorOverrideService,
		@IModeService private _modeService: IModeService
	) {
		super();
		this.registerEditorOverrides();
		// Refresh the editor overrides whenever the languages change so we ensure we always have
		// the latest up to date list of extensions for each language
		this._modeService.onLanguagesMaybeChanged(() => {
			this.registerEditorOverrides();
		});
	}

	private registerEditorOverrides(): void {
		this._registeredOverrides.clear();
		// List of language IDs to associate the query editor for. These are case sensitive.
		NotebookEditorInputAssociation.languages.map(lang => {
			const langExtensions = this._modeService.getExtensions(lang);
			if (langExtensions.length === 0) {
				return;
			}
			// Create the selector from the list of all the language extensions we want to associate with the
			// notebook editor (filtering out any languages which didn't have any extensions registered yet)
			const selector = `*{${langExtensions.join(',')}}`;
			this._registeredOverrides.add(this._editorOverrideService.registerContributionPoint(
				selector,
				{
					id: NotebookEditor.ID,
					label: NotebookEditor.LABEL,
					describes: (currentEditor) => currentEditor instanceof FileNotebookInput,
					priority: ContributedEditorPriority.builtin
				},
				{},
				(resource, options, group) => {
					const fileInput = this._editorService.createEditorInput({
						resource: resource
					}) as FileEditorInput;
					// Try to convert the input, falling back to just a plain file input if we're unable to
					const newInput = this.tryConvertInput(fileInput, lang) ?? fileInput;
					return { editor: newInput, options: options, group: group };
				},
				(diffEditorInput, options, group) => {
					// Try to convert the input, falling back to the original input if we're unable to
					const newInput = this.tryConvertInput(diffEditorInput, lang) ?? diffEditorInput;
					return { editor: newInput, options: options, group: group };
				}
			));
		});
	}

	private tryConvertInput(input: IEditorInput, lang: string): IEditorInput | undefined {
		const langAssociation = languageAssociationRegistry.getAssociationForLanguage(lang);
		const notebookEditorInput = langAssociation?.syncConvertinput?.(input);
		if (!notebookEditorInput) {
			this._logService.warn('Unable to create input for overriding editor ', input instanceof DiffEditorInput ? `${input.primary.resource.toString()} <-> ${input.secondary.resource.toString()}` : input.resource.toString());
			return undefined;
		}
		return notebookEditorInput;
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(NotebookEditorOverrideContribution, LifecyclePhase.Starting);
