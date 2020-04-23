/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import { ManageModelsDialog } from '../../../views/models/manageModels/manageModelsDialog';
import { ListModelsEventName } from '../../../views/models/modelViewBase';
import { RegisteredModel } from '../../../modelManagement/interfaces';
import { ViewBase } from '../../../views/viewBase';

describe('Registered Models Dialog', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new ManageModelsDialog(testContext.apiWrapper.object, '');
		view.open();

		should.notEqual(view.dialogView, undefined);
		should.notEqual(view.currentLanguagesTab, undefined);
	});

	it('Should load data successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new ManageModelsDialog(testContext.apiWrapper.object, '');
		view.open();
		let models: RegisteredModel[] = [
			{
				id: 1,
				artifactName: 'model',
				title: '',
				table: {
					databaseName: 'db',
					tableName: 'tb',
					schema: 'dbo'
				}
			}
		];
		view.on(ListModelsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListModelsEventName), { data: models });
		});
		await view.refresh();
	});
});
