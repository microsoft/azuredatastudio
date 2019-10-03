/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InsightsDialogController } from 'sql/workbench/services/insights/browser/insightsDialogController';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { ConnectionManagementService } from 'sql/platform/connection/browser/connectionManagementService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

import * as azdata from 'azdata';
import { equal } from 'assert';
import { Mock, MockBehavior, It } from 'typemoq';
import { TestStorageService } from 'vs/workbench/test/workbenchTestServices';
import { Emitter } from 'vs/base/common/event';
import { InsightsDialogModel } from 'sql/workbench/services/insights/browser/insightsDialogModel';
import { IInsightsConfigDetails } from 'sql/platform/dashboard/browser/insightRegistry';

const testData: string[][] = [
	['1', '2', '3', '4'],
	['5', '6', '7', '8']
];

const testColumns: string[] = [
	'col1',
	'col2'
];

suite('Insights Dialog Controller Tests', () => {
	test('updates correctly with good input', done => {

		let model = new InsightsDialogModel();

		let { runner, complete } = getPrimedQueryRunner(testData, testColumns);

		let instMoq = Mock.ofType(InstantiationService, MockBehavior.Strict);
		instMoq.setup(x => x.createInstance(It.isValue(QueryRunner), It.isAny()))
			.returns(() => runner);

		let connMoq = Mock.ofType(ConnectionManagementService, MockBehavior.Strict, {}, {}, new TestStorageService());
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

		controller.update(<IInsightsConfigDetails>{ query: 'query' }, profile).then(() => {
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
	querymock.setup(x => x.onMessage).returns(x => new Emitter<azdata.IResultMessage>().event);
	querymock.setup(x => x.batchSets).returns(x => {
		return <Array<azdata.BatchSummary>>[
			{
				id: 0,
				resultSetSummaries: [
					{
						columnInfo: <Array<azdata.IDbColumn>>columns.map(c => { return { columnName: c }; }),
						id: 0,
						rowCount: data.length
					}
				]
			}
		];
	});

	querymock.setup(x => x.getQueryRows(It.isAnyNumber(), It.isAnyNumber(), It.isAnyNumber(), It.isAnyNumber()))
		.returns(x => Promise.resolve(<azdata.QueryExecuteSubsetResult>{
			resultSubset: <azdata.ResultSetSubset>{
				rowCount: data.length,
				rows: data.map(r => r.map(c => { return { displayValue: c }; }))
			}
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
