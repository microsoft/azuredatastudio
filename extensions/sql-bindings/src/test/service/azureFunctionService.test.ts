/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as sinon from 'sinon';

import * as azureFunctionService from '../../services/azureFunctionsService';

describe('Create Azure Function with SQL Binding', () => {
	beforeEach(function (): void {
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should create azure function', async () => {

		await azureFunctionService.createAzureFunction('testConnectionString','dbo','test');
	});
});
