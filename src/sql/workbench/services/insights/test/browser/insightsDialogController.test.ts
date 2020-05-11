/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InsightsDialogController } from 'sql/workbench/services/insights/browser/insightsDialogController';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IQueryMessage, BatchSummary, IColumn, ResultSetSubset } from 'sql/workbench/services/query/common/query';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

import { equal } from 'assert';
import { Mock, MockBehavior, It } from 'typemoq';
import { Emitter } from 'vs/base/common/event';
import { InsightsDialogModel } from 'sql/workbench/services/insights/browser/insightsDialogModel';
import { IInsightsConfigDetails } from 'sql/platform/dashboard/browser/insightRegistry';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';

const testData: string[][] = [
	['1', '2', '3', '4'],
	['5', '6', '7', '8']
];

const testColumns: string[] = [
	'col1',
	'col2'
];

suite('Insights Dialog Controller Tests', () => {
	test('updates correctly with good input', async (done) => {

		let model = new InsightsDialogModel();

		let { runner, complete } = getPrimedQueryRunner(testData, testColumns);

		let instMoq = Mock.ofType(InstantiationService, MockBehavior.Strict);
		instMoq.setup(x => x.createInstance(It.isValue(QueryRunner), It.isAny()))
			.returns(() => runner);

		let testinstantiationService = new TestInstantiationService();
		testinstantiationService.stub(IStorageService, new TestStorageService());
		let connMoq = Mock.ofType(ConnectionManagementService, MockBehavior.Strict,
			undefined, // connection store
			undefined, // connection status manager
			undefined, // connection dialog service
			testinstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		connMoq.setup(x => x.connect(It.isAny(), It.isAny()))
			.returns(() => Promise.resolve(undefined));

		let controller = new InsightsDialogController(
			model,
			undefined,
			undefined,
			instMoq.object,
			connMoq.object,
			undefined,
			undefined
		);

		let profile: IConnectionProfile = {
			connectionName: 'newname',
			serverName: 'server',
			databaseName: 'database',
			userName: 'user',
			password: '',
			authenticationType: '',
			savePassword: true,
			groupFullName: '',
			groupId: '',
			getOptionsKey: () => '',
			matches: undefined,
			providerName: '',
			saveProfile: true,
			id: '',
			options: {}
		};

		await controller.update(<IInsightsConfigDetails>{ query: 'query' }, profile);
		// Once we update the controller, listen on when it changes the model and verify the data it
		// puts in is correct
		model.onDataChange(() => {
			for (let i = 0; i < testData.length; i++) {
				for (let j = 0; j < testData[i].length; j++) {
					equal(testData[i][j], model.rows[i][j]);
				}
			}
			done();
		});
		// Fake the query Runner telling the controller the query is complete
		complete();
	});
});

interface IPrimedQueryRunner {
	runner: QueryRunner;
	complete: () => void;
}

/**
* Returns a mock of query runner than will recreate what a query runner does to return data
*/
function getPrimedQueryRunner(data: string[][], columns: string[]): IPrimedQueryRunner {
	const emitter = new Emitter<string>();
	const querymock = Mock.ofType(QueryRunner, MockBehavior.Strict);
	querymock.setup(x => x.onQueryEnd).returns(x => emitter.event);
	querymock.setup(x => x.onMessage).returns(x => new Emitter<[IQueryMessage]>().event);
	querymock.setup(x => x.batchSets).returns(x => {
		return <Array<BatchSummary>>[
			{
				id: 0,
				resultSetSummaries: [
					{
						columnInfo: <Array<IColumn>>columns.map(c => { return { columnName: c }; }),
						id: 0,
						rowCount: data.length
					}
				]
			}
		];
	});

	querymock.setup(x => x.getQueryRows(It.isAnyNumber(), It.isAnyNumber(), It.isAnyNumber(), It.isAnyNumber()))
		.returns(x => Promise.resolve(<ResultSetSubset>{
			rowCount: data.length,
			rows: data.map(r => r.map(c => { return { displayValue: c }; }))
		}));

	querymock.setup(x => x.runQuery(It.isAnyString())).returns(x => Promise.resolve());

	const complete = () => {
		emitter.fire('time');
	};

	return {
		runner: querymock.object,
		complete
	};
}
