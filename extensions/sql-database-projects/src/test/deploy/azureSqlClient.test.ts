/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { AzureSqlClient } from '../../models/deploy/azureSqlClient';
import { IAccount, IAzureAccountService, IAzureAccountSession, IAzureResourceService, azure } from 'vscode-mssql';



export interface TestContext {
	azureAccountService: IAzureAccountService;
	azureResourceService: IAzureResourceService;
	accounts: IAccount[];
	session: IAzureAccountSession;
	subscriptions: azure.subscription.Subscription[];
	locations: azure.subscription.Location[];
	groups: azure.resources.ResourceGroup[];
}

export function createContext(): TestContext {
	const accounts = [{
		key: undefined!,
		displayInfo: undefined!,
		properties: {
			azureAuthType: 0,
			providerSettings: {
				scopes: [],
				displayName: '',
				id: '',
				clientId: '',
				loginEndpoint: '',
				portalEndpoint: '',
				redirectUri: '',
				resources: {
					windowsManagementResource: {
						id: '',
						resource: '',
						endpoint: ''
					},
					azureManagementResource: {
						id: '',
						resource: '',
						endpoint: ''
					}
				}
			},
			isMsAccount: false,
			owningTenant: {
				id: '',
				displayName: ''
			},
			tenants: [{
				id: '',
				displayName: ''
			}]
		},
		isStale: false,
		isSignedIn: true
	}];
	const subscriptions: azure.subscription.Subscription[] = [{ subscriptionId: 'id1' }, { subscriptionId: 'id2' }];
	const locations: azure.subscription.Location[] = [{ id: 'id1' }, { id: 'id2' }];
	const groups: azure.resources.ResourceGroup[] = [{ id: 'id1', location: 'l1' }, { id: 'id2', location: 'l2' }];
	const session: IAzureAccountSession = {
		account: accounts[0],
		subscription: subscriptions[0],
		tenantId: 'tenantId',
		token: {
			key: '',
			token: '',
			tokenType: '',
		}
	};
	return {
		groups: groups,
		locations: locations,
		subscriptions: subscriptions,
		session: session,
		accounts: accounts,
		azureAccountService: {
			addAccount: () => Promise.resolve(accounts[0]),
			getAccounts: () => Promise.resolve(accounts),
			getAccountSecurityToken: () => Promise.resolve({
				key: '',
				token: '',
				tokenType: ''
			}),
			getAccountSessions: () => Promise.resolve([session])
		},
		azureResourceService: {
			getLocations: () => Promise.resolve(locations),
			getResourceGroups: () => Promise.resolve(groups),
			createOrUpdateServer: () => Promise.resolve('new_server')
		}
	};
}

describe('Azure SQL client', function (): void {

	it('Should return accounts successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient(() => Promise.resolve(testContext.azureAccountService));
		const accounts = await azureSqlClient.getAccounts();
		should(accounts.length).equal(testContext.accounts.length);
	});

	it('Should create and return new account successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient(() => Promise.resolve(testContext.azureAccountService));
		const account = await azureSqlClient.getAccount();
		should(account.key).equal(testContext.accounts[0].key);
	});

	it('Should return subscriptions successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient(() => Promise.resolve(testContext.azureAccountService));
		const result = await azureSqlClient.getSessions(testContext.accounts[0]);
		should(result[0].subscription.id).deepEqual(testContext.subscriptions[0].id);
	});

	it('Should return locations successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient(() => Promise.resolve(testContext.azureAccountService), () => Promise.resolve(testContext.azureResourceService));
		const result = await azureSqlClient.getLocations(testContext.session);
		should(result.length).deepEqual(testContext.locations.length);
	});

	it('Should return resource groups successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient(() => Promise.resolve(testContext.azureAccountService), () => Promise.resolve(testContext.azureResourceService));
		const result = await azureSqlClient.getResourceGroups(testContext.session);
		should(result.length).deepEqual(testContext.groups.length);
		should(result[0].location).deepEqual(testContext.groups[0].location);
	});
});
