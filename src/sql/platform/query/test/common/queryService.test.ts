/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryService, IQueryProvider, IResultMessage } from 'sql/platform/query/common/queryService';
import { TestConnectionService } from 'sql/platform/connection/test/common/testConnectionService';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';

suite('Query Service', () => {
	test('does handle basic connection', async () => {
		const [queryService, connectionService] = createService();


	});
});

function createService(): [QueryService, TestConnectionService, TestQueryProvider] {
	const connectionService = new TestConnectionService();
	const queryService = new QueryService(connectionService);
	const provider = new TestQueryProvider();
	queryService.registerProvider(provider);
	return [queryService, connectionService, provider];
}

class TestQueryProvider implements IQueryProvider {
	readonly id = 'testqueryprovider';
	readonly onMessageEmitter = new Emitter<IResultMessage | IResultMessage[]>();
	readonly onMessage = this.onMessageEmitter.event;

	runQuery(connectionId: string, file: URI): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
