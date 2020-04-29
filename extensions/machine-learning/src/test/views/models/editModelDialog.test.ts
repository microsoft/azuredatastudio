/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import { ImportedModel } from '../../../modelManagement/interfaces';
import { EditModelDialog } from '../../../views/models/manageModels/editModelDialog';

describe('Edit Model Dialog', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: {
				databaseName: 'db',
				tableName: 'tb',
				schema: 'dbo'
			}
		};
		let view = new EditModelDialog(testContext.apiWrapper.object, '', undefined, model);
		view.open();

		should.notEqual(view.dialogView, undefined);
	});
});
