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
import { range } from 'vs/base/common/arrays';

suite('Query Service', () => {
	test('does handle basic query', async () => {
		const [queryService, connectionService, provider] = createService();
		const connectionId = 'connectionId';
		sinon.stub(connectionService, 'getIdForConnection', () => connectionId);

		const query = queryService.createOrGetQuery(basicConnection(), URI.from({ scheme: 'untitled' }));

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

		const resultSetUpdated = await new Promise<IResultSet>(r => {
			Event.once(query.onResultSetUpdated)(e => r(e));
			provider.onResultSetUpdatedEmitter.fire({ connectionId, ...resultSetNotification, completed: true, rowCount: 200 });
		});

		assert(resultSetUpdated.completed);
		assert.deepEqual(resultSetUpdated.columns, resultSetNotification.columns);
		assert(resultSetUpdated.rowCount === 200);

		await new Promise<void>(r => {
			Event.once(query.onQueryComplete)(e => r(e));
			provider.onQueryCompleteEmitter.fire({ connectionId });
		});

		assert(query.state === QueryState.NOT_EXECUTING);

		assert.deepEqual(query.messages, [messageNotification]);
		assert(query.resultSets.length === 1);
		assert.deepEqual(query.resultSets[0].columns, resultSetNotification.columns);
		assert(query.resultSets[0].rowCount === 200);
		assert(query.resultSets[0].completed);
	});

	test('does clear state on execute', async () => {
		const [queryService, connectionService, provider] = createService();
		const connectionId = 'connectionId';
		sinon.stub(connectionService, 'getIdForConnection', () => connectionId);

		const query = queryService.createOrGetQuery(basicConnection(), URI.from({ scheme: 'untitled' }));

		await query.execute();

		assert(query.state === QueryState.EXECUTING);

		const resultSetNotification = {
			completed: true,
			rowCount: 100,
			batchId: 0,
			id: 0,
			columns: [{ title: 'column1', type: ColumnType.UNKNOWN }]
		};

		const resultSet = await new Promise<IResultSet>(r => {
			Event.once(query.onResultSetAvailable)(e => r(e));
			provider.onResultSetAvailableEmitter.fire({ connectionId, ...resultSetNotification });
		});

		assert(resultSet.completed);
		assert.deepEqual(resultSet.columns, resultSetNotification.columns);
		assert(resultSet.rowCount === resultSetNotification.rowCount);

		assert(query.resultSets.length === 1);

		await new Promise<void>(r => {
			Event.once(query.onQueryComplete)(e => r(e));
			provider.onQueryCompleteEmitter.fire({ connectionId });
		});

		assert(query.state === QueryState.NOT_EXECUTING);

		await query.execute();

		assert(query.state === QueryState.EXECUTING);

		const resultSet2 = await new Promise<IResultSet>(r => {
			Event.once(query.onResultSetAvailable)(e => r(e));
			provider.onResultSetAvailableEmitter.fire({ connectionId, ...resultSetNotification });
		});

		assert(resultSet2.completed);
		assert.deepEqual(resultSet2.columns, resultSetNotification.columns);
		assert(resultSet2.rowCount === resultSetNotification.rowCount);

		assert(query.resultSets.length === 1);

		await new Promise<void>(r => {
			Event.once(query.onQueryComplete)(e => r(e));
			provider.onQueryCompleteEmitter.fire({ connectionId });
		});

		assert(query.state === QueryState.NOT_EXECUTING);
	});

	test('does cancel query on request', async () => {
		const [queryService, connectionService, provider] = createService();
		const connectionId = 'connectionId';
		sinon.stub(connectionService, 'getIdForConnection', () => connectionId);
		const cancelStub = sinon.stub(provider, 'cancelQuery', () => Promise.resolve('message'));

		const query = queryService.createOrGetQuery(basicConnection(), URI.from({ scheme: 'untitled' }));
		await query.execute();

		assert(query.state === QueryState.EXECUTING);
		await query.cancel();

		assert(query.state === QueryState.NOT_EXECUTING);
		assert(cancelStub.calledOnce);
	});

	test('does fetch data correctly', async () => {
		const [queryService, connectionService, provider] = createService();
		const connectionId = 'connectionId';
		sinon.stub(connectionService, 'getIdForConnection', () => connectionId);

		const resultSetNotification = {
			completed: true,
			rowCount: 100,
			batchId: 0,
			id: 0,
			columns: [{ title: 'column1', type: ColumnType.UNKNOWN }]
		};

		const query = queryService.createOrGetQuery(basicConnection(), URI.from({ scheme: 'untitled' }));
		await query.execute();

		const resultSet = await new Promise<IResultSet>(r => {
			Event.once(query.onResultSetAvailable)(e => r(e));
			provider.onResultSetAvailableEmitter.fire({ connectionId, ...resultSetNotification });
		});

		const fetchStub = sinon.stub(provider, 'fetchSubset', (): Promise<IFetchResponse> => {
			return Promise.resolve({
				rowCount: 100,
				rows: generateData(100, 1)
			});
		});

		const data = await resultSet.fetch(0, 100);

		assert(fetchStub.calledOnce);
		assert(fetchStub.calledWithExactly(connectionId, 0, 0, 0, 100));
		assert(data.rowCount === 100);
		assert(data.rows[0].every((r, i) => r === `0_${i}`)); // check just first row
	});
});

function generateData(rowCount: number, columnCount: number): Array<Array<any>> {
	return range(rowCount).map(r => range(columnCount).map(c => `${r}_${c}`));
}

function createService(): [QueryService, TestConnectionService, TestQueryProvider] {
	const connectionService = new TestConnectionService();
	const queryService = new QueryService(connectionService);
	const provider = new TestQueryProvider();
	queryService.registerProvider(provider);
	return [queryService, connectionService, provider];
}

/**
 * Returns a basic connection to be used, mainly in a function to fix reference errors
 */
function basicConnection(): IConnection {
	return {
		connect: () => Promise.resolve({ failed: false }),
		disconnect: () => Promise.resolve(),
		onDidConnect: Promise.resolve({ failed: false }),
		onDidStateChange: Event.None,
		provider: TestQueryProvider.ID,
		state: ConnectionState.CONNECTED
	};
}

class TestQueryProvider implements IQueryProvider {
	public static readonly ID = 'testqueryprovider';
	public get id() { return TestQueryProvider.ID; }

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

	cancelQuery(connectionId: string): Promise<string> {
		throw new Error('Method not implemented.');
	}
}
