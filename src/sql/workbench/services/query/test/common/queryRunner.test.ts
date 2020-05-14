/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { BatchSummary, ResultSetSummary, IResultMessage, ResultSetSubset, CompleteBatchSummary } from 'sql/workbench/services/query/common/query';
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
		const queryStartPromise = Event.toPromise(runner.onQueryStart);
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
		const returnBatch = await trigger(batch, arg => runner.handleBatchStart(arg), runner.onBatchStart);
		assert.deepEqual(returnBatch, batch);
		// we expect the query runner to create a message sense we sent a selection
		assert(runner.messages.length === 1);
		// start result set
		const result1: ResultSetSummary = { batchId: 0, id: 0, complete: false, rowCount: 0, columnInfo: [{ columnName: 'column' }] };
		const returnResult = await trigger(result1, arg => runner.handleResultSetAvailable(arg), runner.onResultSet);
		assert.deepEqual(returnResult, result1);
		assert.deepEqual(runner.batchSets[0].resultSetSummaries[0], result1);
		// update result set
		const result1Update: ResultSetSummary = { batchId: 0, id: 0, complete: true, rowCount: 100, columnInfo: [{ columnName: 'column' }] };
		const returnResultUpdate = await trigger(result1Update, arg => runner.handleResultSetUpdated(arg), runner.onResultSetUpdate);
		assert.deepEqual(returnResultUpdate, result1Update);
		assert.deepEqual(runner.batchSets[0].resultSetSummaries[0], result1Update);
		// post message
		const message: IResultMessage = { message: 'some message', isError: false, batchId: 0 };
		const messageReturn = await trigger([message], arg => runner.handleMessage(arg), runner.onMessage);
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
		const batchCompleteReturn = await trigger(batchComplete, arg => runner.handleBatchComplete(arg), runner.onBatchEnd);
		assert.deepStrictEqual(batchCompleteReturn, batchComplete);
		// query complete
		await trigger([batchComplete], arg => runner.handleQueryComplete(arg), runner.onQueryEnd);
		assert(!runner.isExecuting);
		assert(runner.hasCompleted);
		await runner.disposeQuery();
	});

	test('does handle inital query failure', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStub = sinon.stub().returns(Promise.reject(new Error('some error')));
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQuery', runQueryStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		// start query
		const queryCompletePromise = Event.toPromise(runner.onQueryEnd);
		const rangeSelection = { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 };
		await runner.runQuery(rangeSelection);
		await queryCompletePromise;
		assert(runQueryStub.calledOnce);
		assert(runQueryStub.calledWithExactly(uri, rangeSelection, undefined));
		assert(runner.messages.length === 2);
		assert(runner.messages[0].message.includes('some error'));
		assert(runner.messages[0].isError);
	});

	test('does handle cancel query', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		assert(!runner.isExecuting);
		// start query
		const rangeSelection = { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 };
		await runner.runQuery(rangeSelection);
		assert(runner.isExecuting);
		// cancel query
		const cancelQueryStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'cancelQuery', cancelQueryStub);
		await runner.cancelQuery();
		assert(cancelQueryStub.calledOnce);
		await trigger([], () => runner.handleQueryComplete(), runner.onQueryEnd);
		assert(!runner.isExecuting);
	});

	test('does handle query plan in inital data set', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQuery', runQueryStub);
		await runner.runQuery(undefined, { displayEstimatedQueryPlan: true });
		assert(runQueryStub.calledOnce);
		assert(runQueryStub.calledWithExactly(uri, undefined, { displayEstimatedQueryPlan: true }));
		const xmlPlan = 'xml plan';
		const getRowsStub = sinon.stub().returns(Promise.resolve({ rowCount: 1, rows: [[{ displayValue: xmlPlan }]] } as ResultSetSubset));
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'getQueryRows', getRowsStub);
		runner.handleBatchStart({ id: 0, executionStart: '' });
		runner.handleResultSetAvailable({ id: 0, batchId: 0, complete: true, rowCount: 1, columnInfo: [{ columnName: 'Microsoft SQL Server 2005 XML Showplan' }] });
		const plan = await runner.planXml;
		assert(getRowsStub.calledOnce);
		assert.equal(plan, xmlPlan);
		assert(runner.isQueryPlan);
	});

	test('does handle query plan in update', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQuery', runQueryStub);
		await runner.runQuery(undefined, { displayEstimatedQueryPlan: true });
		assert(runQueryStub.calledOnce);
		assert(runQueryStub.calledWithExactly(uri, undefined, { displayEstimatedQueryPlan: true }));
		runner.handleBatchStart({ id: 0, executionStart: '' });
		runner.handleResultSetAvailable({ id: 0, batchId: 0, complete: false, rowCount: 0, columnInfo: [{ columnName: 'Microsoft SQL Server 2005 XML Showplan' }] });
		const xmlPlan = 'xml plan';
		const getRowsStub = sinon.stub().returns(Promise.resolve({ rowCount: 1, rows: [[{ displayValue: xmlPlan }]] } as ResultSetSubset));
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'getQueryRows', getRowsStub);
		runner.handleResultSetUpdated({ id: 0, batchId: 0, complete: true, rowCount: 1, columnInfo: [{ columnName: 'Microsoft SQL Server 2005 XML Showplan' }] });
		const plan = await runner.planXml;
		assert(getRowsStub.calledOnce);
		assert.equal(plan, xmlPlan);
		assert(runner.isQueryPlan);
	});

	test('does run query string', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStringStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQueryString', runQueryStringStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		// start query
		await runner.runQuery('some query');
		assert(runQueryStringStub.calledOnce);
		assert(runQueryStringStub.calledWithExactly(uri, 'some query'));
		assert(runner.isExecuting);
	});

	test('does handle run query string error', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStringStub = sinon.stub().returns(Promise.reject(new Error('some error')));
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQueryString', runQueryStringStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		// start query
		const queryCompletePromise = Event.toPromise(runner.onQueryEnd);
		await runner.runQuery('some query');
		await queryCompletePromise;
		assert(runQueryStringStub.calledOnce);
		assert(runQueryStringStub.calledWithExactly(uri, 'some query'));
		assert(runner.messages.length === 2);
		assert(runner.messages[0].message.includes('some error'));
		assert(runner.messages[0].isError);
	});

	test('does run query statement', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStatementStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQueryStatement', runQueryStatementStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		// start query
		const rangeSelection = { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 };
		await runner.runQueryStatement(rangeSelection);
		assert(runQueryStatementStub.calledOnce);
		assert(runQueryStatementStub.calledWithExactly(uri, rangeSelection.startLineNumber, rangeSelection.startColumn));
		assert(runner.isExecuting);
	});

	test('does handle run query statement error', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStatementStub = sinon.stub().returns(Promise.reject(new Error('some error')));
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQueryStatement', runQueryStatementStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		// start query
		const queryCompletePromise = Event.toPromise(runner.onQueryEnd);
		const rangeSelection = { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 };
		await runner.runQueryStatement(rangeSelection);
		await queryCompletePromise;
		assert(runQueryStatementStub.calledOnce);
		assert(runQueryStatementStub.calledWithExactly(uri, rangeSelection.startLineNumber, rangeSelection.startColumn));
		assert(runner.messages.length === 2);
		assert(runner.messages[0].message.includes('some error'));
		assert(runner.messages[0].isError);
	});
});

function trigger<T, V = T>(arg: T, func: (arg: T) => void, event: Event<V>): Promise<V> {
	const promise = Event.toPromise(event);
	func(arg);
	return promise;
}
