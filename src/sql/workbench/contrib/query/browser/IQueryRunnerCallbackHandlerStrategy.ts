/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryMessage, ResultSetSummary } from 'sql/workbench/services/query/common/query';

export interface IQueryRunnerCallbackHandlerStrategy {
	onQueryStart();
	onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]);
	updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]);
	onMessage(incomingMessage: IQueryMessage | IQueryMessage[], setInput?: boolean);
	reset();
}
