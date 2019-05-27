/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IModeSupport, IEditorInput } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { FileQueryEditorInput } from 'sql/workbench/parts/query/common/fileQueryEditorInput';
import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { UntitledQueryEditorInput } from 'sql/workbench/parts/query/common/untitledQueryEditorInput';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';

/**
 * Handles setting a mode from the editor status and converts inputs if necessary
 */
export function setMode(accessor: ServicesAccessor, modeSupport: IModeSupport, activeEditor: IEditorInput, language: string): void {
	const editorService = accessor.get(IEditorService);
	const instantiationService = accessor.get(IInstantiationService);
	const activeWidget = getCodeEditor(editorService.activeTextEditorWidget);
	const activeControl = editorService.activeControl;
	const textModel = activeWidget.getModel();
	if (language === 'sql' && textModel.getLanguageIdentifier().language !== 'sql') {

		if (activeEditor.isDirty()) {
			const notificationService = accessor.get(INotificationService);
			notificationService.error(localize('languageChangeUnsupported', "Changing languages on unsaved files is unsupported"));
			return;
		}
		// switching to sql
		modeSupport.setMode(language);
		if (activeEditor instanceof FileEditorInput) {
			const queryResultsInput = instantiationService.createInstance(QueryResultsInput, activeEditor.getResource().toString());
			const queryInput = instantiationService.createInstance(FileQueryEditorInput, '', activeEditor, queryResultsInput, undefined);
			editorService.replaceEditors([{ editor: activeEditor, replacement: queryInput }], activeControl.group);
		} else {
			const queryResultsInput = instantiationService.createInstance(QueryResultsInput, activeEditor.getResource().toString());
			const queryInput = instantiationService.createInstance(UntitledQueryEditorInput, '', activeEditor, queryResultsInput, undefined);
			editorService.replaceEditors([{ editor: activeEditor, replacement: queryInput }], activeControl.group);
		}
	} else if (language !== 'sql' && textModel.getLanguageIdentifier().language === 'sql') {

		if (activeEditor.isDirty()) {
			const notificationService = accessor.get(INotificationService);
			notificationService.error(localize('languageChangeUnsupported', "Changing languages on unsaved files is unsupported"));
			return;
		}
		// switching from sql
		modeSupport.setMode(language);
		if (activeEditor instanceof FileQueryEditorInput || activeEditor instanceof UntitledQueryEditorInput) {
			editorService.replaceEditors([{ editor: activeEditor, replacement: activeEditor.text }], activeControl.group);
		}
	} else {
		modeSupport.setMode(language);
	}
}
