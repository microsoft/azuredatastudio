/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as assert from 'assert';
import { QueryService, IQueryProvider, IResultMessage, IQueryProviderEvent, IResultSetSummary, IFetchResponse, QueryState, IResultSet, ColumnType } from 'sql/platform/query/common/queryService';
import { TestConnectionService } from 'sql/platform/connection/test/common/testConnectionService';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IConnection, ConnectionState } from 'sql/platform/connection/common/connectionService';

suite('Query Service', () => {

	const basicConnection: IConnection = {
		connect: () => Promise.resolve({ failed: false }),
		onDidConnect: Promise.resolve({ failed: false }),
		onDidStateChange: Event.None,
		provider: TestQueryProvider.id,
		state: ConnectionState.CONNECTED
	};

	test('does handle basic query', async () => {
		const [queryService, connectionService, provider] = createService();
		const connectionId = 'connectionId';
		sinon.stub(connectionService, 'getIdForConnection', () => connectionId);

		const query = queryService.createOrGetQuery(basicConnection, URI.from({ scheme: 'untitled' }));

		assert(query.state === QueryState.NOT_EXECUTING);
		assert(query.associatedFile.toString() === URI.from({ scheme: 'untitled' }).toString());

		await query.execute();

		assert(query.state === QueryState.EXECUTING);

		const messageNotification = { message: 'some message', isError: false };

		const message = await new Promise<IResultMessage>(r => {
			Event.once(query.onMessage)(e => r(e as IResultMessage));
			provider.onMessageEmitter.fire({ connectionId, messages: messageNotification });
		});

		assert.deepEqual(message, messageNotification);

		const resultSetNotification = {
			completed: false,
			rowCount: 100,
			batchId: 0,
			id: 0,
			columns: [{ title: 'column1', type: ColumnType.UNKNOWN }]
		};

		const resultSet = await new Promise<IResultSet>(r => {
			Event.once(query.onResultSetAvailable)(e => r(e));
			provider.onResultSetAvailableEmitter.fire({ connectionId, ...resultSetNotification });
		});

		assert(resultSet.completed === resultSetNotification.completed);
		assert.deepEqual(resultSet.columns, resultSetNotification.columns);
		assert(resultSet.rowCount === resultSetNotification.rowCount);
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
	static readonly id = 'testqueryprovider';
	readonly id = TestQueryProvider.id;

	readonly onMessageEmitter = new Emitter<IQueryProviderEvent & { messages: IResultMessage | ReadonlyArray<IResultMessage> }>();
	readonly onMessage = this.onMessageEmitter.event;

	readonly onResultSetAvailableEmitter = new Emitter<IQueryProviderEvent & IResultSetSummary>();
	readonly onResultSetAvailable = this.onResultSetAvailableEmitter.event;

	readonly onResultSetUpdatedEmitter = new Emitter<IQueryProviderEvent & IResultSetSummary>();
	readonly onResultSetUpdated = this.onResultSetUpdatedEmitter.event;

	readonly onQueryCompleteEmitter = new Emitter<IQueryProviderEvent>();
	readonly onQueryComplete = this.onQueryCompleteEmitter.event;

	runQuery(connectionId: string, file: URI): Promise<void> {
		return Promise.resolve();
	}

	fetchSubset(connectionId: string, resultSetId: number, batchId: number, offset: number, count: number): Promise<IFetchResponse> {
		throw new Error('Method not implemented.');
	}
}
