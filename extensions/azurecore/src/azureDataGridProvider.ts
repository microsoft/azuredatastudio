/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AppContext } from './appContext';
import { AzureResourceServiceNames } from './azureResource/constants';
import { IAzureResourceSubscriptionService } from './azureResource/interfaces';
import { AzureAccountProperties, azureResource } from 'azurecore';
import * as azureResourceUtils from './azureResource/utils';
import * as constants from './constants';
import * as loc from './localizedConstants';
import * as utils from './utils';
import { Logger } from './utils/Logger';

const typesClause = [
	azureResource.AzureResourceType.sqlDatabase,
	azureResource.AzureResourceType.sqlServer,
	azureResource.AzureResourceType.sqlSynapseWorkspace,
	azureResource.AzureResourceType.sqlSynapseSqlPool,
	azureResource.AzureResourceType.sqlManagedInstance,
	azureResource.AzureResourceType.postgresServer,
	azureResource.AzureResourceType.postgresFlexibleServer,
	azureResource.AzureResourceType.azureArcService,
	azureResource.AzureResourceType.azureArcSqlManagedInstance,
	azureResource.AzureResourceType.azureArcPostgresServer
].map(type => `type == "${type}"`).join(' or ');

export class AzureDataGridProvider implements azdata.DataGridProvider {
	constructor(private _appContext: AppContext) { }

	public providerId = constants.dataGridProviderId;
	public title = loc.azureResourcesGridTitle;

	public async getDataGridItems() {
		let accounts: azdata.Account[];
		accounts = await azdata.accounts.getAllAccounts();
		const items: any[] = [];
		await Promise.all(accounts.map(async (account) => {
			await Promise.all(account.properties.tenants.map(async (tenant: { id: string; }) => {
				try {
					const subscriptionService = this._appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
					const subscriptions = await subscriptionService.getSubscriptions(account, [tenant.id]);
					try {
						const newItems = (await azureResourceUtils.runResourceQuery(account, subscriptions, true, `where ${typesClause}`)).resources
							.map(item => {
								return <azdata.DataGridItem>{
									id: item.id,
									// Property values
									name: item.name,
									resourceGroup: item.resourceGroup,
									subscriptionId: item.subscriptionId,
									subscriptionName: subscriptions.find(subscription => subscription.id === item.subscriptionId)?.name ?? item.subscriptionId,
									locationDisplayName: utils.getRegionDisplayName(item.location),
									type: item.type,
									typeDisplayName: utils.getResourceTypeDisplayName(item.type),
									iconPath: utils.getResourceTypeIcon(this._appContext, item.type),
									portalEndpoint: (account.properties as AzureAccountProperties).providerSettings.settings.portalEndpoint
								};
							});
						items.push(...newItems);
					} catch (err) {
						Logger.error(err);
					}
				} catch (err) {
					Logger.error(err);
				}
			}));
		}));
		return items;
	}

	public async getDataGridColumns(): Promise<azdata.DataGridColumn[]> {
		return [
			{ id: 'icon', type: 'image', field: 'iconPath', name: '', width: 25, sortable: false, filterable: false, resizable: false, tooltip: loc.typeIcon },
			{ id: 'name', type: 'text', field: 'name', name: loc.name, width: 150 },
			{ id: 'type', type: 'text', field: 'typeDisplayName', name: loc.resourceType, width: 150 },
			{ id: 'resourceGroup', type: 'text', field: 'resourceGroup', name: loc.resourceGroup, width: 150 },
			{ id: 'location', type: 'text', field: 'locationDisplayName', name: loc.location, width: 150 },
			{ id: 'subscriptionId', type: 'text', field: 'subscriptionName', name: loc.subscription, width: 150 }
		];
	}
}
