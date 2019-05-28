/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IModeSupport, IEditorInput } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';

import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/common/languageAssociation';

const languageAssociationRegistry = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

/**
 * Handles setting a mode from the editor status and converts inputs if necessary
 */
export function setMode(accessor: ServicesAccessor, modeSupport: IModeSupport, activeEditor: IEditorInput, language: string): void {
	const editorService = accessor.get(IEditorService);
	const instantiationService = accessor.get(IInstantiationService);
	const activeWidget = getCodeEditor(editorService.activeTextEditorWidget);
	const activeControl = editorService.activeControl;
	const textModel = activeWidget.getModel();
	const oldLanguage = textModel.getLanguageIdentifier().language;
	if (language !== oldLanguage) {
		const oldInputCreator = languageAssociationRegistry.getAssociations().filter(e => e.language === oldLanguage)[0];
		const newInputCreator = languageAssociationRegistry.getAssociations().filter(e => e.language === language)[0];
		if ((oldInputCreator || newInputCreator) && activeEditor.isDirty()) {
			const notificationService = accessor.get(INotificationService);
			notificationService.error(localize('languageChangeUnsupported', "Changing editor types on unsaved files is unsupported"));
			return;
		}
		modeSupport.setMode(language);
		let input: IEditorInput;
		if (oldInputCreator) {
			input = oldInputCreator.baseInputCreator(activeEditor);
		}

		if (newInputCreator) {
			const newInput = instantiationService.invokeFunction(newInputCreator.creator, input || activeEditor);
			if (newInput) {
				editorService.replaceEditors([{ editor: activeEditor, replacement: newInput }], activeControl.group);
			}
		} else if (oldInputCreator) {
			editorService.replaceEditors([{ editor: activeEditor, replacement: input }], activeControl.group);
		}
	}
}
