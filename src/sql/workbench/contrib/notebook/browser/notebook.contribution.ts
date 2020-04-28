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
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
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
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerTreeContext';
import { ManageActionContext } from 'sql/workbench/browser/actions';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { MarkdownOutputComponent } from 'sql/workbench/contrib/notebook/browser/outputs/markdownOutput.component';
import { registerCellComponent } from 'sql/platform/notebooks/common/outputRegistry';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { NotebookThemingContribution } from 'sql/workbench/contrib/notebook/browser/notebookThemingContribution';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { ToggleTabFocusModeAction } from 'vs/editor/contrib/toggleTabFocusMode/toggleTabFocusMode';

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(FileNotebookInput.ID, FileNoteBookEditorInputFactory);

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(UntitledNotebookInput.ID, UntitledNoteBookEditorInputFactory);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation(NotebookEditorInputAssociation.languages, NotebookEditorInputAssociation);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(new EditorDescriptor(NotebookEditor, NotebookEditor.ID, localize('notebookEditor.name', "Notebook Editor")), [new SyncDescriptor(UntitledNotebookInput), new SyncDescriptor(FileNotebookInput)]);

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
