/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { SQLFuture } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ResultSetSubset, ResultSetSummary } from 'sql/workbench/services/query/common/query';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { NullLogService } from 'vs/platform/log/common/log';

suite('SQL Future', function () {
	let sqlFuture: SQLFuture;
	let queryRunner: TypeMoq.Mock<QueryRunner>;

	suiteSetup(async () => {
		let configurationService = new TestConfigurationService();
		let logService = new NullLogService();
		queryRunner = TypeMoq.Mock.ofType(QueryRunner);
		sqlFuture = new SQLFuture(queryRunner.object, undefined, configurationService, logService);
	});

	test('Rows returned from SQL Tools Service are correctly converted to data resource and html', async function (): Promise<void> {
		const resultSet: ResultSetSummary = {
			batchId: 0,
			columnInfo: [{ columnName: 'col1' }, { columnName: 'col2' }],
			complete: true,
			id: 0,
			rowCount: 2
		};
		const subset: ResultSetSubset = {
			rowCount: 2,
			rows: [[{ displayValue: '1' }, { displayValue: '2' }], [{ displayValue: '3' }, { displayValue: '4' }]]
		};
		const expectedData = {
			'application/vnd.dataresource+json': {
				data: [{ 0: '1', 1: '2' }, { 0: '3', 1: '4' }],
				schema: { fields: [{ name: 'col1' }, { name: 'col2' }] }
			},
			'text/html': ['<table>', '<tr><th>col1</th><th>col2</th></tr>', '<tr><td>1</td><td>2</td></tr>', '<tr><td>3</td><td>4</td></tr>', '</table>']
		};
		const expectedMsg: nb.IIOPubMessage = {
			channel: 'iopub',
			type: 'iopub',
			header: <nb.IHeader>{
				msg_id: undefined,
				msg_type: 'execute_result'
			},
			content: <nb.IExecuteResult>{
				output_type: 'execute_result',
				metadata: undefined,
				execution_count: this._executionCount,
				data: expectedData
			},
			metadata: {
				batchId: 0,
				id: 0
			},
			parent_header: undefined
		};

		let handler: nb.MessageHandler<nb.IIOPubMessage> = {
			handle: (msg: nb.IIOPubMessage) => { }
		};
		let handleSpy = sinon.spy(handler, 'handle');
		sqlFuture.setIOPubHandler(handler);

		queryRunner.setup(x => x.getQueryRows(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(subset));
		sqlFuture.handleResultSet(resultSet);
		await sqlFuture.handleDone();
		sinon.assert.calledWith(handleSpy, expectedMsg);
	});
});
