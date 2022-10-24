/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as sql from '../models/dataSources/sqlConnectionStringSource';
import * as dataSources from '../models/dataSources/dataSources';

describe('Data Sources: DataSource operations', function (): void {
	before(async function () : Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function(): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it.skip('Should read DataSources from datasource.json', async function (): Promise<void> {
		const dataSourcePath = await testUtils.createTestDataSources(baselines.openDataSourcesBaseline);
		const dataSourceList = await dataSources.load(dataSourcePath);

		should(dataSourceList.length).equal(3);

		should(dataSourceList[0].name).equal('Test Data Source 1');
		should(dataSourceList[0].type).equal(sql.SqlConnectionDataSource.type);
		should((dataSourceList[0] as sql.SqlConnectionDataSource).database).equal('testDb');

		should(dataSourceList[1].name).equal('My Other Data Source');
		should((dataSourceList[1] as sql.SqlConnectionDataSource).integratedSecurity).equal(false);

		should(dataSourceList[2].name).equal('AAD Interactive Data Source');
		should((dataSourceList[2] as sql.SqlConnectionDataSource).integratedSecurity).equal(false);
		should((dataSourceList[2] as sql.SqlConnectionDataSource).azureMFA).equal(true);
	});

	it ('Should be able to create sql data source from connection strings with and without ending semicolon', function (): void {
		should.doesNotThrow(() => new sql.SqlConnectionDataSource('no ending semicolon', 'Data Source=(LOCAL);Initial Catalog=testdb;User id=sa;Password=PLACEHOLDER'));
		should.doesNotThrow(() => new sql.SqlConnectionDataSource('ending in semicolon', 'Data Source=(LOCAL);Initial Catalog=testdb;User id=sa;Password=PLACEHOLDER;'));
		should.throws(() => new sql.SqlConnectionDataSource('invalid extra equals sign', 'Data Source=(LOCAL);Initial Catalog=testdb=extra;User id=sa;Password=PLACEHOLDER'));
	});
});
