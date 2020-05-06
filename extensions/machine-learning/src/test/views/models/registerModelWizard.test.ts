/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import { ListModelsEventName, ListAccountsEventName, ListSubscriptionsEventName, ListGroupsEventName, ListWorkspacesEventName, ListAzureModelsEventName, ModelSourceType, ListDatabaseNamesEventName, ListTableNamesEventName } from '../../../views/models/modelViewBase';
import { ImportedModel } from '../../../modelManagement/interfaces';
import { azureResource } from '../../../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { ViewBase } from '../../../views/viewBase';
import { WorkspaceModel } from '../../../modelManagement/interfaces';
import { ImportModelWizard } from '../../../views/models/manageModels/importModelWizard';

describe('Register Model Wizard', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new ImportModelWizard(testContext.apiWrapper.object, '');
		view.importTable = {
			databaseName: 'db',
			tableName: 'table',
			schema: 'dbo'
		};
		await view.open();
		should.notEqual(view.wizardView, undefined);
		should.notEqual(view.modelSourcePage, undefined);
	});

	it('Should load data successfully ', async function (): Promise<void> {
		let testContext = createContext();

		let view = new ImportModelWizard(testContext.apiWrapper.object, '');
		view.importTable = {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		};
		await view.open();
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
		view.on(ListModelsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListModelsEventName), { data: localModels });
		});
		view.on(ListDatabaseNamesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListDatabaseNamesEventName), { data: [
				'db', 'db1'
			] });
		});
		view.on(ListTableNamesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListTableNamesEventName), { data: [
				'tb', 'tb1'
			] });
		});
		view.on(ListAccountsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAccountsEventName), { data: accounts });
		});
		view.on(ListSubscriptionsEventName, () => {

			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListSubscriptionsEventName), { data: subscriptions });
		});
		view.on(ListGroupsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListGroupsEventName), { data: groups });
		});
		view.on(ListWorkspacesEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListWorkspacesEventName), { data: workspaces });
		});
		view.on(ListAzureModelsEventName, () => {
			view.sendCallbackRequest(ViewBase.getCallbackEventName(ListAzureModelsEventName), { data: models });
		});

		if (view.modelBrowsePage) {
			view.modelBrowsePage.modelSourceType = ModelSourceType.Azure;
		}
		await view.refresh();
		should.notEqual(view.azureModelsComponent?.data ,undefined);
		should.notEqual(view.localModelsComponent?.data, undefined);
	});
});
