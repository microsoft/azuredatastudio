/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

import { NotebookInput } from 'sql/workbench/parts/notebook/notebookInput';
import { NotebookEditor } from 'sql/workbench/parts/notebook/notebookEditor';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/common/languageAssociation';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// Model View editor registration
const viewModelEditorDescriptor = new EditorDescriptor(
	NotebookEditor,
	NotebookEditor.ID,
	'Notebook'
);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation('notebook', (accessor, editor) => {
		const instantiationService = accessor.get(IInstantiationService);
		return instantiationService.createInstance(NotebookInput, editor.getName(), editor.getResource(), editor);
	}, (editor: NotebookInput) => editor.textInput);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(viewModelEditorDescriptor, [new SyncDescriptor(NotebookInput)]);
