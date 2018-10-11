/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TPromise } from 'vs/base/common/winjs.base';
import * as nls from 'vs/nls';

import { NotebookInput, NotebookInputModel } from 'sql/parts/notebook/notebookInput';
import { NotebookEditor } from 'sql/parts/notebook/notebookEditor';

/**
 * todo: Will remove this code.
 * This is the entry point to open the new Notebook
 */
export class OpenNotebookAction extends Action {

	public static ID = 'OpenNotebookAction';
	public static LABEL = nls.localize('OpenNotebookAction', 'Open Notebook editor');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
	}

	public run(): TPromise<void> {
		return new TPromise<void>((resolve, reject) => {
			let model = new NotebookInputModel('modelViewId', undefined, undefined);
			let input = new NotebookInput('modelViewId', model);
			this._editorService.openEditor(input, { pinned: true });
		});
	}
}

// Model View editor registration
const viewModelEditorDescriptor = new EditorDescriptor(
	NotebookEditor,
	NotebookEditor.ID,
	'Notebook'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(viewModelEditorDescriptor, [new SyncDescriptor(NotebookInput)]);

// todo: Will remove this code.
// this is the entry point to open the new Notebook
let actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		OpenNotebookAction,
		OpenNotebookAction.ID,
		OpenNotebookAction.LABEL
	),
	OpenNotebookAction.LABEL
);