/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IModeSupport, IEditorInput } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';

import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';

const languageAssociationRegistry = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

/**
 * Handles setting a mode from the editor status and converts inputs if necessary
 */
export async function setMode(accessor: ServicesAccessor, modeSupport: IModeSupport, activeEditor: IEditorInput, language: string): Promise<void> {
	const editorService = accessor.get(IEditorService);
	const activeWidget = getCodeEditor(editorService.activeTextEditorControl);
	const activeControl = editorService.activeEditorPane;
	const textModel = activeWidget.getModel();
	const oldLanguage = textModel.getLanguageIdentifier().language;
	if (language !== oldLanguage) {
		const oldInputCreator = languageAssociationRegistry.getAssociationForLanguage(oldLanguage); // who knows how to handle the current language
		const newInputCreator = languageAssociationRegistry.getAssociationForLanguage(language); // who knows how to handle the requested language
		if ((oldInputCreator || newInputCreator) && activeEditor.isDirty()) { // theres some issues with changing the language on a dirty file with one of our editors (we should look into this)
			const notificationService = accessor.get(INotificationService);
			notificationService.error(localize('languageChangeUnsupported', "Changing editor types on unsaved files is unsupported"));
			return;
		}
		modeSupport.setMode(language);
		let input: IEditorInput;
		if (oldInputCreator) { // only transform the input if we have someone who knows how to deal with it (e.x QueryInput -> UntitledInput, etc)
			input = oldInputCreator.createBase(activeEditor);
		}

		if (newInputCreator) { // if we know how to handle the new language, tranform the input and replace the editor (e.x notebook, sql, etc)
			const newInput = newInputCreator.convertInput(input || activeEditor);
			if (newInput) {  // the factory will return undefined if it doesn't know how to handle the input
				await editorService.replaceEditors([{ editor: activeEditor, replacement: await newInput }], activeControl.group);
			}
		} else if (oldInputCreator) { // if we don't know handle to handle the new language but we know how to handle the current language, replace the editor with the reverted input (e.x sql -> text)
			await editorService.replaceEditors([{ editor: activeEditor, replacement: input }], activeControl.group);
		} // otherwise we don't know the old language and we don't know the new langauge, so don't do anything and just let vscode handle it (e.x text -> powershell)
	}
}
