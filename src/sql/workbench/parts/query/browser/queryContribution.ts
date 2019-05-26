/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IEditorService, IOpenEditorOverride } from 'vs/workbench/services/editor/common/editorService';
import { IEditorInput } from 'vs/workbench/common/editor';
import { IEditorOptions, ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IModeService } from 'vs/editor/common/services/modeService';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { isUndefined } from 'vs/base/common/types';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { UntitledQueryEditorInput } from 'sql/workbench/parts/query/common/untitledQueryEditorInput';
import { FileQueryEditorInput } from 'sql/workbench/parts/query/common/fileQueryEditorInput';

export class QueryContribution implements IWorkbenchContribution {
	private editorOpeningListener: IDisposable;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IModeService private readonly modeService: IModeService
	) {
		this.editorOpeningListener = this.editorService.overrideOpenEditor((editor, options, group) => this.onEditorOpening(editor, options, group));
	}

	private onEditorOpening(editor: IEditorInput, options: IEditorOptions | ITextEditorOptions | undefined, group: IEditorGroup): IOpenEditorOverride | undefined {
		// If the resource was already opened before in the group, do not prevent
		// the opening of that resource. Otherwise we would have the same settings
		// opened twice (https://github.com/Microsoft/vscode/issues/36447)
		if (group.isOpened(editor)) {
			return undefined;
		}

		// this is the case when the file is on disk
		if (editor instanceof FileEditorInput) {
			let mode = editor.getPreferredMode();
			if (!mode) { // in the case the input doesn't have a preferred mode set we will attempt to guess the mode from the file path
				mode = this.modeService.getModeIdByFilepathOrFirstLine(editor.getResource().fsPath);
			}
			if (mode === 'sql') {
				const queryResultsInput = this.instantiationService.createInstance(QueryResultsInput, editor.getResource().toString());
				const queryInput = this.instantiationService.createInstance(FileQueryEditorInput, '', editor, queryResultsInput, undefined);
				return { override: this.editorService.openEditor(queryInput, options, group) };
			}
		}

		// this is untitled
		if (editor instanceof UntitledEditorInput) {
			const mode = editor.getMode();
			if (isUndefined(mode) || mode === 'sql') {
				editor.setMode('sql');
				const queryResultsInput = this.instantiationService.createInstance(QueryResultsInput, editor.getResource().toString());
				const queryInput = this.instantiationService.createInstance(UntitledQueryEditorInput, '', editor, queryResultsInput, undefined);
				return { override: this.editorService.openEditor(queryInput, options, group) };
			}
		}

		return undefined;
	}

	dispose(): void {
		dispose(this.editorOpeningListener);
	}
}
