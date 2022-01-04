/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryMessage, ResultSetSummary } from 'sql/workbench/services/query/common/query';

export interface IQueryResultsWriter {
	onQueryStart(): void | Promise<void>;
	onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]): void | Promise<void>;
	updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]): void | Promise<void>;
	onMessage(incomingMessage: IQueryMessage | IQueryMessage[], setInput?: boolean): void | Promise<void>;
	reset(): void;
}
