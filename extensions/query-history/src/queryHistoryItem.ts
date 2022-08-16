/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export interface QueryHistoryItem {
	readonly queryText: string,
	readonly connectionProfile: azdata.connection.ConnectionProfile | undefined,
	readonly timestamp: Date,
	readonly isSuccess: boolean
}
