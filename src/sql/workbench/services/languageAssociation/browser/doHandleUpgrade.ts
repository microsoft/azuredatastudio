/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput } from 'vs/workbench/common/editor';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import { Extensions as ILanguageAssociationExtensions, ILanguageAssociationRegistry } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { Registry } from 'vs/platform/registry/common/platform';

const languageRegistry = Registry.as<ILanguageAssociationRegistry>(ILanguageAssociationExtensions.LanguageAssociations);

export function doHandleUpgrade(editor: EditorInput): EditorInput {
	if (editor instanceof UntitledTextEditorInput || editor instanceof FileEditorInput) {
		const activeWidget = getCodeEditor(editor);
		const textModel = activeWidget.getModel();
		const oldLanguage = textModel.getLanguageIdentifier().language;
		const association = languageRegistry.getAssociationForLanguage(oldLanguage);
		if (association) {
			return association.convertInput(editor);
		}
	}
	return editor;
}
