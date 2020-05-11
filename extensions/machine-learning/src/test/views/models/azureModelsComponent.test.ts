/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import 'mocha';
import { createContext, ParentDialog } from './utils';
import { AzureModelsComponent } from '../../../views/models/azureModelsComponent';
import { ListAccountsEventName, ListSubscriptionsEventName, ListGroupsEventName, ListWorkspacesEventName, ListAzureModelsEventName } from '../../../views/models/modelViewBase';
import { azureResource } from '../../../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { ViewBase } from '../../../views/viewBase';
import { WorkspaceModel } from '../../../modelManagement/interfaces';

describe('Azure Models Component', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new AzureModelsComponent(testContext.apiWrapper.object, parent);
		view.registerComponent(testContext.view.modelBuilder);
		should.notEqual(view.component, undefined);
	});

	it('Should load data successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);

		let view = new AzureModelsComponent(testContext.apiWrapper.object, parent, false);
		view.registerComponent(testContext.view.modelBuilder);

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
		parent.on(ListAccountsEventName, (args) => {
			parent.sendCallbackRequest(ViewBase.getCallbackEventName(ListAccountsEventName), { inputArgs: args, data: accounts });
		});
		parent.on(ListSubscriptionsEventName, (args) => {

			parent.sendCallbackRequest(ViewBase.getCallbackEventName(ListSubscriptionsEventName), { inputArgs: args, data: subscriptions });
		});
		parent.on(ListGroupsEventName, (args) => {
			parent.sendCallbackRequest(ViewBase.getCallbackEventName(ListGroupsEventName), { inputArgs: args, data: groups });
		});
		parent.on(ListWorkspacesEventName, (args) => {
			parent.sendCallbackRequest(ViewBase.getCallbackEventName(ListWorkspacesEventName), { inputArgs: args, data: workspaces });
		});
		parent.on(ListAzureModelsEventName, (args) => {
			parent.sendCallbackRequest(ViewBase.getCallbackEventName(ListAzureModelsEventName), { inputArgs: args, data: models });
		});
		await view.refresh();
		testContext.onClick.fire(true);
		should.notEqual(view.data, undefined);
		should.equal(view.data?.length, 1);
		if (view.data) {
			should.deepEqual(view.data[0].account, accounts[0]);
			should.deepEqual(view.data[0].subscription, subscriptions[0]);
			should.deepEqual(view.data[0].group, groups[0]);
			should.deepEqual(view.data[0].workspace, workspaces[0]);
			should.deepEqual(view.data[0].model, models[0]);
		}
	});
});
