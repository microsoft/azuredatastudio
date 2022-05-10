/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryResultsWriterMode } from 'sql/workbench/contrib/query/common/queryResultsWriterStatus';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IQuickInputService, QuickPickInput } from 'vs/platform/quickinput/common/quickInput';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class ChangeQueryResultsOutputAction extends Action {
	public static ID = 'workbench.action.editor.changeQueryResultsOutput';
	public static LABEL = nls.localize('changeQueryResultsOutput', 'Change Results Output Mode');
	private static RESULTS_TO_FILE = nls.localize('workbench.action.editor.queryResultsToFile', 'Query Results to File');
	private static RESULTS_TO_GRID = nls.localize('workbench.action.editor.queryResultsToGrid', 'Query Results to Grid');

	constructor(
		actionId: string,
		actionLabel: string,
		@IEditorService private readonly editorService: IEditorService,
		@IQuickInputService private readonly quickInputService: IQuickInputService
	) {
		super(actionId, actionLabel);
	}

	override async run(): Promise<void> {
		let editor = this.editorService.activeEditorPane as QueryEditor;
		if (!editor) {
			await this.quickInputService.pick([{ label: nls.localize('noEditor', "No text editor active at this time") }]);
			return;
		}


		const outputModes = [ChangeQueryResultsOutputAction.RESULTS_TO_GRID, ChangeQueryResultsOutputAction.RESULTS_TO_FILE];
		const picks: QuickPickInput[] = outputModes.map(mode => {
			return {
				label: mode
			};
		});

		const pick = await this.quickInputService.pick(picks, { placeHolder: nls.localize('pickLanguage', "Select Query Results Output Mode"), matchOnDescription: true });
		if (!pick) {
			return;
		}

		if (pick.label === ChangeQueryResultsOutputAction.RESULTS_TO_GRID) {
			editor.queryResultsWriterMode = QueryResultsWriterMode.ToGrid;
		}
		else {
			editor.queryResultsWriterMode = QueryResultsWriterMode.ToFile;
		}
	}
}
