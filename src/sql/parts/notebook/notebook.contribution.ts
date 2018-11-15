/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TPromise } from 'vs/base/common/winjs.base';
import { Schemas } from 'vs/base/common/network';
import URI from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { NotebookInput, NotebookInputModel, notebooksEnabledCondition } from 'sql/parts/notebook/notebookInput';
import { NotebookEditor } from 'sql/parts/notebook/notebookEditor';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';


let counter = 0;

/**
 * todo: Will remove this code.
 * This is the entry point to open the new Notebook
 */
export class NewNotebookAction extends Action {

	public static ID = 'workbench.action.newnotebook';
	public static LABEL = localize('workbench.action.newnotebook.description', 'New Notebook');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): TPromise<void> {
		let title = `Untitled-${counter++}`;
		let untitledUri = URI.from({ scheme: Schemas.untitled, path: title });
		let model = new NotebookInputModel(untitledUri, undefined, false, undefined);
		let input = this._instantiationService.createInstance(NotebookInput, title, model);
		return this._editorService.openEditor(input, { pinned: true }).then(() => undefined);
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

// Feature flag for built-in Notebooks. Will be removed in the future.
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'notebook',
	'title': 'Notebook',
	'type': 'object',
	'properties': {
		'notebook.enabled': {
			'type': 'boolean',
			'default': false,
			'description': localize('notebook.enabledDescription', 'Enable viewing notebook files using built-in notebook editor.')
		}
	}
});

// this is the entry point to open the new Notebook
CommandsRegistry.registerCommand(NewNotebookAction.ID, serviceAccessor => {
	serviceAccessor.get(IInstantiationService).createInstance(NewNotebookAction, NewNotebookAction.ID, NewNotebookAction.LABEL).run();
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: NewNotebookAction.ID,
		title:NewNotebookAction.LABEL,
	},
	when: notebooksEnabledCondition
});