/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';

import { NotebookInput } from 'sql/workbench/parts/notebook/notebookInput';
import { NotebookEditor } from 'sql/workbench/parts/notebook/notebookEditor';
import { NewNotebookAction } from 'sql/workbench/parts/notebook/notebookActions';
import { KeyMod } from 'vs/editor/common/standalone/standaloneBase';
import { KeyCode } from 'vs/base/common/keyCodes';
import { registerComponentType } from 'sql/workbench/parts/notebook/outputs/mimeRegistry';
import { MimeRendererComponent as MimeRendererComponent } from 'sql/workbench/parts/notebook/outputs/mimeRenderer.component';

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
		{ primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KEY_N },

	),
	NewNotebookAction.LABEL
);

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
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});

/**
 * A mime renderer component for LaTeX.
 * This will be replaced by a dedicated component in the future
 */
registerComponentType({
	mimeTypes: ['text/latex'],
	rank: 70,
	safe: true,
	ctor: MimeRendererComponent,
	selector: MimeRendererComponent.SELECTOR
});
