/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { BatchSummary, ResultSetSummary, IResultMessage, IQueryMessage, ResultSetSubset, CompleteBatchSummary } from 'sql/workbench/services/query/common/query';
import { URI } from 'vs/base/common/uri';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { Event } from 'vs/base/common/event';
import { range } from 'vs/base/common/arrays';

suite('Query Runner', () => {
	test('does execute a standard selection query workflow', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQuery', runQueryStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		// start query
		const queryStartPromise = new Promise(r => Event.once(runner.onQueryStart)(() => r()));
		const rangeSelection = { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 };
		await runner.runQuery(rangeSelection);
		assert(runQueryStub.calledOnce);
		assert(runQueryStub.calledWithExactly(uri, rangeSelection, undefined));
		await queryStartPromise;
		assert(runner.queryStartTime instanceof Date);
		assert(runner.isExecuting);
		assert(!runner.hasCompleted);
		// start batch
		const batch: BatchSummary = { id: 0, hasError: false, range: rangeSelection, resultSetSummaries: [], executionStart: '' };
		const batchStartPromise = new Promise<BatchSummary>(r => Event.once(runner.onBatchStart)(b => r(b)));
		runner.handleBatchStart(batch);
		const returnBatch = await batchStartPromise;
		assert.deepEqual(returnBatch, batch);
		// we expect the query runner to create a message sense we sent a selection
		assert(runner.messages.length === 1);
		// start result set
		const result1: ResultSetSummary = { batchId: 0, id: 0, complete: false, rowCount: 0, columnInfo: [{ columnName: 'column' }] };
		const resultPromise = new Promise<ResultSetSummary>(r => Event.once(runner.onResultSet)(b => r(b)));
		runner.handleResultSetAvailable(result1);
		const returnResult = await resultPromise;
		assert.deepEqual(returnResult, result1);
		assert.deepEqual(runner.batchSets[0].resultSetSummaries[0], result1);
		// update result set
		const result1Update: ResultSetSummary = { batchId: 0, id: 0, complete: true, rowCount: 100, columnInfo: [{ columnName: 'column' }] };
		const resultUpdatePromise = new Promise<ResultSetSummary>(r => Event.once(runner.onResultSetUpdate)(b => r(b)));
		runner.handleResultSetUpdated(result1Update);
		const returnResultUpdate = await resultUpdatePromise;
		assert.deepEqual(returnResultUpdate, result1Update);
		assert.deepEqual(runner.batchSets[0].resultSetSummaries[0], result1Update);
		// post message
		const message: IResultMessage = { message: 'some message', isError: false, batchId: 0 };
		const messagePromise = new Promise<IQueryMessage[]>(r => Event.once(runner.onMessage)(b => r(b)));
		runner.handleMessage([message]);
		const messageReturn = await messagePromise;
		assert.deepEqual(messageReturn[0], message);
		assert.deepEqual(runner.messages[1], message);
		// get query rows
		const rowResults: ResultSetSubset = { rowCount: 100, rows: range(100).map(r => range(1).map(c => ({ displayValue: `${r}${c}` }))) };
		const getRowStub = sinon.stub().returns(Promise.resolve(rowResults));
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'getQueryRows', getRowStub);
		const resultReturn = await runner.getQueryRows(0, 100, 0, 0);
		assert(getRowStub.calledWithExactly({ ownerUri: uri, batchIndex: 0, resultSetIndex: 0, rowsStartIndex: 0, rowsCount: 100 }));
		assert.deepStrictEqual(resultReturn, rowResults);
		// batch complete
		const batchComplete: CompleteBatchSummary = { ...batch, executionEnd: 'endstring', executionElapsed: 'elapsedstring' };
		const batchCompletePromise = new Promise<CompleteBatchSummary>(r => Event.once(runner.onBatchEnd)(b => r(b)));
		runner.handleBatchComplete(batchComplete);
		const batchCompleteReturn = await batchCompletePromise;
		assert.deepStrictEqual(batchCompleteReturn, batchComplete);
		// query complete
		const queryCompletePromise = new Promise<string>(r => Event.once(runner.onQueryEnd)(b => r(b)));
		runner.handleQueryComplete([batchComplete]);
		await queryCompletePromise;
		assert(!runner.isExecuting);
		assert(runner.hasCompleted);
		await runner.disposeQuery();
	});
});
