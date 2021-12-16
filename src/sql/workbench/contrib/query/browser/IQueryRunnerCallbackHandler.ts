/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryMessage } from 'sql/workbench/services/query/common/query';

export interface IQueryRunnerCallbackHandler {
	onQueryStart();
	onResultSet();
	updateResultSet();
	onMessage(message: IQueryMessage | IQueryMessage[], setInput: boolean);
	reset();
}
