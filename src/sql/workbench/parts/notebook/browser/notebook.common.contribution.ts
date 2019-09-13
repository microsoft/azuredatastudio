/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor, registerAction, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';

import { NotebookInput } from 'sql/workbench/parts/notebook/browser/models/notebookInput';
import { NotebookEditor } from 'sql/workbench/parts/notebook/browser/notebookEditor';
import { NewNotebookAction } from 'sql/workbench/parts/notebook/browser/notebookActions';
import { KeyMod } from 'vs/editor/common/standalone/standaloneBase';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { localize } from 'vs/nls';
import { GridOutputComponent } from 'sql/workbench/parts/notebook/browser/outputs/gridOutput.component';
import { PlotlyOutputComponent } from 'sql/workbench/parts/notebook/browser/outputs/plotlyOutput.component';
import { registerComponentType } from 'sql/workbench/parts/notebook/browser/outputs/mimeRegistry';
import { MimeRendererComponent } from 'sql/workbench/parts/notebook/browser/outputs/mimeRenderer.component';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { URI } from 'vs/base/common/uri';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspace/common/workspaceEditing';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainer } from 'vs/workbench/common/views';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { NodeContextKey } from 'sql/workbench/parts/dataExplorer/browser/nodeContext';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/browser/mssqlNodeContext';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ConnectedContext } from 'azdata';
import { TreeNodeContextKey } from 'sql/workbench/parts/objectExplorer/common/treeNodeContextKey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ObjectExplorerActionsContext } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerActions';
import { ItemContextKey } from 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerTreeContext';
import { ManageActionContext } from 'sql/workbench/browser/actions';

// Model View editor registration
const viewModelEditorDescriptor = new EditorDescriptor(
	NotebookEditor,
	NotebookEditor.ID,
	'Notebook'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(viewModelEditorDescriptor, [new SyncDescriptor(NotebookInput)]);

// Global Actions
let actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
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
		return instantiationService.createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run(connectedContext);
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
	handler: (accessor, args: ObjectExplorerActionsContext) => {
		const instantiationService = accessor.get(IInstantiationService);
		const connectedContext: ConnectedContext = { connectionProfile: args.connectionProfile };
		return instantiationService.createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run(connectedContext);
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
	instantiationService.createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run(connectedContext);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerNotebookActionID,
		title: NewNotebookAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});

registerAction({
	id: 'workbench.action.setWorkspaceAndOpen',
	handler: async (accessor, options: { forceNewWindow: boolean, folderPath: URI }) => {
		const viewletService = accessor.get(IViewletService);
		const workspaceEditingService = accessor.get(IWorkspaceEditingService);
		const windowService = accessor.get(IWindowService);
		let folders = [];
		if (!options.folderPath) {
			return;
		}
		folders.push(options.folderPath);
		await workspaceEditingService.addFolders(folders.map(folder => ({ uri: folder })));
		await viewletService.openViewlet(viewletService.getDefaultViewletId(), true);
		if (options.forceNewWindow) {
			return windowService.openWindow([{ folderUri: folders[0] }], { forceNewWindow: options.forceNewWindow });
		}
		else {
			return windowService.reloadWindow();
		}
	}
});

const configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'notebook',
	'title': 'Notebook',
	'type': 'object',
	'properties': {
		'notebook.useInProcMarkdown': {
			'type': 'boolean',
			'default': true,
			'description': localize('notebook.inProcMarkdown', "Use in-process markdown viewer to render text cells more quickly (Experimental).")
		}
	}
});

/**
* Explorer viewlet id.
*/
export const VIEWLET_ID = 'bookTreeView';
/**
* Explorer viewlet container.
*/
export const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(VIEWLET_ID);
registerAction({
	id: 'workbench.books.action.focusBooksExplorer',
	handler: async (accessor) => {
		const viewletService = accessor.get(IViewletService);
		viewletService.openViewlet('workbench.view.extension.books-explorer', true);
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
