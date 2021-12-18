/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsDisplayStatus, QueryResultsDisplayMode } from 'sql/workbench/contrib/query/common/queryResultsDisplayStatus';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';

export class QueryResultsToFileAction extends Action {
	public static ID = 'sql.action.query.queryResultsToFile';
	public static LABEL = nls.localize('queryResults.resultsToFile', 'Query Results to File');

	private queryResultsDisplayStatus: QueryResultsDisplayStatus;

	constructor(actionId: string, actionLabel: string) {
		super(actionId, actionLabel);

		this.queryResultsDisplayStatus = QueryResultsDisplayStatus.getInstance();
	}

	public override run(): Promise<any> {
		this.queryResultsDisplayStatus.mode = QueryResultsDisplayMode.ResultsToFile;

		return Promise.resolve();
	}
}

export class QueryResultsToGridAction extends Action {
	public static ID = 'sql.action.query.queryResultsToGrid';
	public static LABEL = nls.localize('queryResults.resultsToGrid', 'Query Results to Grid');

	private queryResultsDisplayStatus: QueryResultsDisplayStatus;

	constructor(actionId: string, actionLabel: string) {
		super(actionId, actionLabel);

		this.queryResultsDisplayStatus = QueryResultsDisplayStatus.getInstance();
	}

	public override run(): Promise<any> {
		this.queryResultsDisplayStatus.mode = QueryResultsDisplayMode.ResultsToGrid;

		return Promise.resolve();
	}
}
