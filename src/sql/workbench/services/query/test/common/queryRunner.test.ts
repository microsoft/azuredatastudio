/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { BatchSummary } from 'sql/workbench/services/query/common/query';
import { URI } from 'vs/base/common/uri';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { Event } from 'vs/base/common/event';

suite('Query Runner', () => {
	test('does execute a standard selection query', async () => {
		const instantiationService = workbenchInstantiationService();
		const uri = URI.parse('test:uri').toString();
		const runner = instantiationService.createInstance(QueryRunner, uri);
		const runQueryStub = sinon.stub().returns(Promise.resolve());
		(instantiationService as TestInstantiationService).stub(IQueryManagementService, 'runQuery', runQueryStub);
		assert(!runner.isExecuting);
		assert(!runner.hasCompleted);
		const queryStartPromise = new Promise(r => Event.once(runner.onQueryStart)(() => r()));
		const range = { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 };
		await runner.runQuery(range);
		assert(runQueryStub.calledOnce);
		assert(runQueryStub.calledWithExactly(uri, range, undefined));
		await queryStartPromise;
		assert(runner.queryStartTime instanceof Date);
		const batch: BatchSummary = { id: 0, hasError: false, range, resultSetSummaries: [], executionStart: '' };
		const batchStartPromise = new Promise<BatchSummary>(r => Event.once(runner.onBatchStart)(b => r(b)));
		runner.handleBatchStart(batch);
		const returnBatch = await batchStartPromise;
		assert.deepEqual(returnBatch, batch);
	});
});
