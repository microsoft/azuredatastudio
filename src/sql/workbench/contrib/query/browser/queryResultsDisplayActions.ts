/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryResultsWriterMode } from 'sql/workbench/contrib/query/common/queryResultsDisplayStatus';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class QueryResultsToFileAction extends Action {
	public static ID = 'sql.action.query.queryResultsToFile';
	public static LABEL = nls.localize('queryResults.resultsToFile', 'Query Results to File');

	constructor(
		actionId: string,
		actionLabel: string,
		@IEditorService private readonly editorService: IEditorService
	) {
		super(actionId, actionLabel);
	}

	public override run(): Promise<void> {
		let editor = this.editorService.activeEditorPane as QueryEditor;
		editor.queryResultsWriterMode = QueryResultsWriterMode.ToFile;

		return Promise.resolve();
	}
}

export class QueryResultsToGridAction extends Action {
	public static ID = 'sql.action.query.queryResultsToGrid';
	public static LABEL = nls.localize('queryResults.resultsToGrid', 'Query Results to Grid');

	constructor(
		actionId: string,
		actionLabel: string,
		@IEditorService private readonly editorService: IEditorService
	) {
		super(actionId, actionLabel);
	}

	public override run(): Promise<void> {
		let editor = this.editorService.activeEditorPane as QueryEditor;
		editor.queryResultsWriterMode = QueryResultsWriterMode.ToGrid;

		return Promise.resolve();
	}
}
