/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import { ListModelsEventName, ListAccountsEventName, ListSubscriptionsEventName, ListGroupsEventName, ListWorkspacesEventName, ListAzureModelsEventName, ModelSourceType, ListDatabaseNamesEventName, ListTableNamesEventName, VerifyImportTableEventName } from '../../../views/models/modelViewBase';
import { ImportedModel } from '../../../modelManagement/interfaces';
import { azureResource } from '../../../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { ViewBase } from '../../../views/viewBase';
import { WorkspaceModel } from '../../../modelManagement/interfaces';
import { ImportModelWizard } from '../../../views/models/manageModels/importModelWizard';
import { DatabaseTable } from '../../../prediction/interfaces';

let accounts: azdata.Account[] = [
	{
		key: {
			accountId: '1',
			providerId: ''
		},
		displayInfo: {
			displayName: 'account',
			userId: '',
			accountType: '',
			contextualDisplayName: ''
		},
		isStale: false,
		properties: []
	}
];
let subscriptions: azureResource.AzureResourceSubscription[] = [
	{
		name: 'subscription',
		id: '2'
	}
];
let groups: azureResource.AzureResourceResourceGroup[] = [
	{
		name: 'group',
		id: '3'
	}
];
let workspaces: Workspace[] = [
	{
		name: 'workspace',
		id: '4'
	}
];
let models: WorkspaceModel[] = [
	{
		id: '5',
		name: 'model'
	}
];
let localModels: ImportedModel[] = [
	{
		id: 1,
		modelName: 'model',
		table: {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		}
	}
];

let importTable: DatabaseTable = {
	databaseName: 'db',
	tableName: 'tb',
	schema: 'dbo'
};
describe('Register Model Wizard', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new ImportModelWizard(testContext.apiWrapper.object, '');
		view.importTable = importTable;
		await view.open();
		should.notEqual(view.wizardView, undefined);
		should.notEqual(view.modelSourcePage, undefined);
	});

	it('Should load data successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new ImportModelWizard(testContext.apiWrapper.object, '');
		view.importTable = importTable;
		await view.open();
		setEvents(view);
		await view.refresh();
		should.notEqual(view.modelBrowsePage, undefined);

		if (view.modelBrowsePage) {
			view.modelBrowsePage.modelSourceType = ModelSourceType.Azure;
			await view.modelBrowsePage.refresh();
			should.equal(view.modelBrowsePage.modelSourceType, ModelSourceType.Azure);
		}
		should.notEqual(view.azureModelsComponent?.data, undefined);
		should.notEqual(view.localModelsComponent?.data, undefined);
	});

	function setEvents(view: ImportModelWizard): void {
		view.on(ListModelsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListModelsEventName), { inputArgs: args, data: localModels });
		});
		view.on(ListDatabaseNamesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListDatabaseNamesEventName), {
				inputArgs: args, data: [
					'db', 'db1'
				]
			});
		});
		view.on(ListTableNamesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListTableNamesEventName), {
				inputArgs: args, data: [
					'tb', 'tb1'
				]
			});
		});
		view.on(ListAccountsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAccountsEventName), { inputArgs: args, data: accounts });
		});
		view.on(ListSubscriptionsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListSubscriptionsEventName), { inputArgs: args, data: subscriptions });
		});
		view.on(ListGroupsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListGroupsEventName), { inputArgs: args, data: groups });
		});
		view.on(ListWorkspacesEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListWorkspacesEventName), { inputArgs: args, data: workspaces });
		});
		view.on(ListAzureModelsEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAzureModelsEventName), { inputArgs: args, data: models });
		});
		view.on(VerifyImportTableEventName, (args) => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(VerifyImportTableEventName), { inputArgs: args, data: view.importTable });
		});
	}
});
