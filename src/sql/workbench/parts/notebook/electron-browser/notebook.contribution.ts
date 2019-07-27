/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor, registerAction } from 'vs/platform/actions/common/actions';

import { NotebookInput } from 'sql/workbench/parts/notebook/node/notebookInput';
import { NotebookEditor } from 'sql/workbench/parts/notebook/electron-browser/notebookEditor';
import { NewNotebookAction } from 'sql/workbench/parts/notebook/electron-browser/notebookActions';
import { KeyMod } from 'vs/editor/common/standalone/standaloneBase';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { localize } from 'vs/nls';
import product from 'vs/platform/product/node/product';
import { GridOutputComponent } from 'sql/workbench/parts/notebook/outputs/gridOutput.component';
import { PlotlyOutputComponent } from 'sql/workbench/parts/notebook/outputs/plotlyOutput.component';
import { registerComponentType } from 'sql/workbench/parts/notebook/electron-browser/outputs/mimeRegistry';
import { MimeRendererComponent } from 'sql/workbench/parts/notebook/electron-browser/outputs/mimeRenderer.component';
import { MarkdownOutputComponent } from 'sql/workbench/parts/notebook/electron-browser/outputs/markdownOutput.component';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspace/common/workspaceEditing';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IWindowService } from 'vs/platform/windows/common/windows';
import { Uri } from 'vscode';

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

registerAction({
	id: 'workbench.action.setWorkspaceAndOpen',
	handler: async (accessor, options: { forceNewWindow: boolean, folderPath: Uri }) => {
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
