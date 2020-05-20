/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestQueryManagementService } from 'sql/workbench/services/query/test/common/testQueryManagementService';
import { Event, Emitter } from 'vs/base/common/event';

export class NBTestQueryManagementService extends TestQueryManagementService {
	readonly _onHandlerAdded = new Emitter<string>();
	onHandlerAdded: Event<string> = this._onHandlerAdded.event;

	getRegisteredProviders(): string[] {
		return ['sql'];
	}
}
