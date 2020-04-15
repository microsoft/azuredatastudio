/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as sql from '../models/dataSources/sqlConnectionStringSource';
import * as dataSources from '../models/dataSources/dataSources';

//import { load } from '../models/dataSources/dataSources';
// import { SqlConnectionDataSource } from '../models/dataSources/sqlConnectionStringSource';

describe('Data Sources: DataSource operations', function (): void {
	it('Should read DataSources from datasource.json', async function (): Promise<void> {
		const dataSourcePath = await testUtils.createTestDataSources(baselines.openDataSourcesBaseline);
		const dataSourceList = await dataSources.load(dataSourcePath);

		should(dataSourceList.length).equal(2);

		should(dataSourceList[0].name).equal('Test Data Source 1');
		should(dataSourceList[0].type).equal(sql.SqlConnectionDataSource.type);
		should((dataSourceList[0] as sql.SqlConnectionDataSource).getSetting('Initial Catalog')).equal('testDb');

		should(dataSourceList[1].name).equal('My Other Data Source');
		should((dataSourceList[1] as sql.SqlConnectionDataSource).getSetting('Integrated Security')).equal('False');
	});
});
