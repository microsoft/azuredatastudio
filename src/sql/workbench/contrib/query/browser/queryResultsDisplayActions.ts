/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsWriterStatus, QueryResultsWriterMode } from 'sql/workbench/contrib/query/common/queryResultsDisplayStatus';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';

export class QueryResultsToFileAction extends Action {
	public static ID = 'sql.action.query.queryResultsToFile';
	public static LABEL = nls.localize('queryResults.resultsToFile', 'Query Results to File');

	private queryResultsWriterStatus: QueryResultsWriterStatus;

	constructor(actionId: string, actionLabel: string) {
		super(actionId, actionLabel);

		this.queryResultsWriterStatus = QueryResultsWriterStatus.getInstance();
	}

	public override run(): Promise<void> {
		this.queryResultsWriterStatus.mode = QueryResultsWriterMode.ToFile;

		return Promise.resolve();
	}
}

export class QueryResultsToGridAction extends Action {
	public static ID = 'sql.action.query.queryResultsToGrid';
	public static LABEL = nls.localize('queryResults.resultsToGrid', 'Query Results to Grid');

	private queryResultsWriterStatus: QueryResultsWriterStatus;

	constructor(actionId: string, actionLabel: string) {
		super(actionId, actionLabel);

		this.queryResultsWriterStatus = QueryResultsWriterStatus.getInstance();
	}

	public override run(): Promise<void> {
		this.queryResultsWriterStatus.mode = QueryResultsWriterMode.ToGrid;

		return Promise.resolve();
	}
}
