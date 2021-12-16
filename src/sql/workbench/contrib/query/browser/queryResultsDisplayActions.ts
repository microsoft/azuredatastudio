/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import ResultsDisplayStatus, { QueryResultsDisplayMode } from 'sql/workbench/contrib/query/common/queryResultsDeliveryStatus';
import { Action } from 'vs/base/common/actions';

export class QueryResultsToFileAction extends Action {
	public static ID = 'sql.action.query.queryResultsToFile';
	public static LABEL = 'Query Results to File'; // TODO lewissanchez: Localize this label with NLS call

	constructor(actionId: string, actionLabel: string) {
		super(actionId, actionLabel);
	}

	public override run(): Promise<any> {
		ResultsDisplayStatus.mode = QueryResultsDisplayMode.ResultsToFile;

		return Promise.resolve();
	}
}

export class QueryResultsToGridAction extends Action {
	public static ID = 'sql.action.query.queryResultsToGrid';
	public static LABEL = 'Query Results to Grid'; // TODO lewissanchez: Localize this label with NLS call

	constructor(actionId: string, actionLabel: string) {
		super(actionId, actionLabel);
	}

	public override run(): Promise<any> {
		ResultsDisplayStatus.mode = QueryResultsDisplayMode.ResultsToGrid;

		return Promise.resolve();
	}
}
