/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { localize } from 'vs/nls';
import { IEditorInputFactoryRegistry, Extensions as EditorInputFactoryExtensions } from 'vs/workbench/common/editor';

import { NotebookInput } from 'sql/workbench/parts/notebook/notebookInput';
import { NotebookEditor } from 'sql/workbench/parts/notebook/notebookEditor';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/common/languageAssociation';
import { UntitledNotebookInput } from 'sql/workbench/parts/notebook/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/parts/notebook/fileNotebookInput';
import { FileNoteBookEditorInputFactory, UntitledNoteBookEditorInputFactory } from 'sql/workbench/parts/notebook/nodebookInputFactory';

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(FileNotebookInput.ID, FileNoteBookEditorInputFactory);

Registry.as<IEditorInputFactoryRegistry>(EditorInputFactoryExtensions.EditorInputFactories)
	.registerEditorInputFactory(UntitledNotebookInput.ID, UntitledNoteBookEditorInputFactory);

Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations)
	.registerLanguageAssociation('notebook', (accessor, editor) => {
		const instantiationService = accessor.get(IInstantiationService);
		if (editor instanceof FileEditorInput) {
			return instantiationService.createInstance(FileNotebookInput, editor.getName(), editor.getResource(), editor);
		} else if (editor instanceof UntitledEditorInput) {
			return instantiationService.createInstance(UntitledNotebookInput, editor.getName(), editor.getResource(), editor);
		} else {
			return undefined;
		}
	}, (editor: NotebookInput) => editor.textInput);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(new EditorDescriptor(NotebookEditor, NotebookEditor.ID, localize('notebookEditor.name', "Notebook Editor")), [new SyncDescriptor(UntitledNotebookInput), new SyncDescriptor(FileNotebookInput)]);
