/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as baselines from '../baselines/baselines';
import * as TypeMoq from 'typemoq';
import { AzureAccountSession, AzureSqlClient, SQLTokenCredential } from '../../models/deploy/azureSqlClient';
import { IAccount, IAzureAccountService } from 'vscode-mssql';
import { SubscriptionClient, Subscription, Subscriptions, Location } from '@azure/arm-subscriptions';
import { PagedAsyncIterableIterator } from '@azure/core-paging';
import { ResourceGroup, ResourceGroups, ResourceManagementClient } from '@azure/arm-resources';

export interface TestContext {
	azureAccountService: IAzureAccountService;
	accounts: IAccount[];
	session: AzureAccountSession;
	subscriptionClient: TypeMoq.IMock<SubscriptionClient>;
	subscriptions: Subscription[];
	locations: Location[];
	groups: ResourceGroup[];
}


export function createContext(): TestContext {
	const accounts = [{
		key: undefined!,
		displayInfo: undefined!,
		properties: {
			tenants: [{
				id: '',
				displayName: ''
			}]
		},
		isStale: false,
		isSignedIn: true
	}];
	const subscriptions: Subscription[] = [{ subscriptionId: 'id1' }, { subscriptionId: 'id2' }];
	const locations: Location[] =  [{ id: 'id1' }, { id: 'id2' }];
	const groups: ResourceGroup[] =  [{ id: 'id1', location: 'l1' }, { id: 'id2', location: 'l2' }];
	const session: AzureAccountSession = {
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
		subscriptionClient: TypeMoq.Mock.ofType(SubscriptionClient, undefined, undefined, new SQLTokenCredential(session.token)),
		session: session,
		accounts: accounts,
		azureAccountService: {
			addAccount: () => Promise.resolve(accounts[0]),
			getAccounts: () => Promise.resolve(accounts),
			getAccountSecurityToken: () => Promise.resolve({
				key: '',
				token: '',
				tokenType: ''
			})
		}
	};
}

let sandbox: sinon.SinonSandbox;

describe('Azure SQL client', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});
	afterEach(function () {
		sandbox.restore();
		sinon.restore();
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	it('Should return accounts successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient();
		azureSqlClient.AzureAccountService = testContext.azureAccountService;
		const accounts = await azureSqlClient.getAccounts();
		should(accounts.length).equal(testContext.accounts.length);
	});

	it('Should create and return new account successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient();
		azureSqlClient.AzureAccountService = testContext.azureAccountService;
		const account = await azureSqlClient.getAccount();
		should(account.key).equal(testContext.accounts[0].key);
	});

	it('Should return subscriptions successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient();
		azureSqlClient.AzureAccountService = testContext.azureAccountService;

		let index = 0;
		let maxLength = testContext.subscriptions.length;
		const subPages: PagedAsyncIterableIterator<Subscription> = {
			next: () => {
				if (index < maxLength) {
					return Promise.resolve({ done: false, value: testContext.subscriptions[index++] });
				} else {
					return Promise.resolve({ done: true, value: undefined });
				}
			},
			byPage: () => undefined!,
			[Symbol.asyncIterator]: undefined!
		};
		const subscriptions: Subscriptions = {
			listLocations: undefined!,
			list: () => subPages,
			get: () => undefined!
		};
		testContext.subscriptionClient.setup(x => x.subscriptions).returns(() => subscriptions);

		azureSqlClient.SubscriptionClient = testContext.subscriptionClient.object;
		const result = await azureSqlClient.getSubscriptions(testContext.accounts[0]);
		should(result[0].subscription.id).deepEqual(testContext.subscriptions[0].id);
	});

	it('Should return locations successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient();
		azureSqlClient.AzureAccountService = testContext.azureAccountService;

		let index = 0;
		let maxLength = testContext.locations.length;
		const pages: PagedAsyncIterableIterator<Location> = {
			next: () => {
				if (index < maxLength) {
					return Promise.resolve({ done: false, value: testContext.locations[index++] });
				} else {
					return Promise.resolve({ done: true, value: undefined });
				}
			},
			byPage: () => undefined!,
			[Symbol.asyncIterator]: undefined!
		};
		const subscriptions: Subscriptions = {
			listLocations: () => pages,
			list: () => undefined!,
			get: () => undefined!
		};
		testContext.subscriptionClient.setup(x => x.subscriptions).returns(() => subscriptions);

		azureSqlClient.SubscriptionClient = testContext.subscriptionClient.object;
		const result = await azureSqlClient.getLocations(testContext.session);
		should(result.length).deepEqual(testContext.locations.length);
	});

	it('Should return resource groups successfully', async function (): Promise<void> {
		const testContext = createContext();
		const azureSqlClient = new AzureSqlClient();
		azureSqlClient.AzureAccountService = testContext.azureAccountService;

		let index = 0;
		let maxLength = testContext.groups.length;
		const pages: PagedAsyncIterableIterator<ResourceGroup> = {
			next: () => {
				if (index < maxLength) {
					return Promise.resolve({ done: false, value: testContext.groups[index++] });
				} else {
					return Promise.resolve({ done: true, value: undefined });
				}
			},
			byPage: () => undefined!,
			[Symbol.asyncIterator]: undefined!
		};
		const resourceGroups: ResourceGroups = {
			list: () => pages,
			get: () => undefined!,
			beginDelete: undefined!,
			beginDeleteAndWait: undefined!,
			beginExportTemplate: undefined!,
			beginExportTemplateAndWait: undefined!,
			checkExistence: undefined!,
			createOrUpdate: undefined!,
			update: undefined!
		};
		const groupClient = TypeMoq.Mock.ofType(ResourceManagementClient, undefined, undefined, new SQLTokenCredential(testContext.session.token), testContext.subscriptions[0].subscriptionId);
		groupClient.setup(x => x.resourceGroups).returns(() => resourceGroups);

		azureSqlClient.ResourceManagementClient = groupClient.object;
		const result = await azureSqlClient.getResourceGroups(testContext.session);
		should(result.length).deepEqual(testContext.groups.length);
		should(result[0].location).deepEqual(testContext.groups[0].location);
	});
});
