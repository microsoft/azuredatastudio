/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import { promises as fs } from 'fs';
import * as uuid from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as utils from '../../common/utils';
import { MockOutputChannel } from './stubs';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import * as vscode from 'vscode';
import { sleep } from './testUtils';

describe('Utils Tests', function () {

	it('getKnoxUrl', () => {
		const host = '127.0.0.1';
		const port = '8080';
		should(utils.getKnoxUrl(host, port)).endWith('/gateway');
	});

	it('getLivyUrl', () => {
		const host = '127.0.0.1';
		const port = '8080';
		should(utils.getLivyUrl(host, port)).endWith('/gateway/default/livy/v1/');
	});

	it('mkDir', async () => {
		const dirPath = path.join(os.tmpdir(), uuid.v4());
		await should(fs.stat(dirPath)).be.rejected();
		await utils.mkDir(dirPath, new MockOutputChannel());
		should.exist(await fs.stat(dirPath), `Folder ${dirPath} did not exist after creation`);
	});

	it('getErrorMessage Error', () => {
		const errMsg = 'Test Error';
		should(utils.getErrorMessage(new Error(errMsg))).equal(errMsg);
	});

	it('getErrorMessage string', () => {
		const errMsg = 'Test Error';
		should(utils.getErrorMessage(errMsg)).equal(errMsg);
	});

	it('getOSPlatform', async () => {
		should(utils.getOSPlatform()).not.throw();
	});

	it('getOSPlatformId', async () => {
		should(utils.getOSPlatformId()).not.throw();
	});

	describe('comparePackageVersions', () => {
		const version1 = '1.0.0.0';
		const version1Revision = '1.0.0.1';
		const version2 = '2.0.0.0';
		const shortVersion1 = '1';

		it('same id', () => {
			should(utils.comparePackageVersions(version1, version1)).equal(0);
		});

		it('first version lower', () => {
			should(utils.comparePackageVersions(version1, version2)).equal(-1);
		});

		it('second version lower', () => {
			should(utils.comparePackageVersions(version2, version1)).equal(1);
		});

		it('short first version is padded correctly', () => {
			should(utils.comparePackageVersions(shortVersion1, version1)).equal(0);
		});

		it('short second version is padded correctly when', () => {
			should(utils.comparePackageVersions(version1, shortVersion1)).equal(0);
		});

		it('correctly compares version with only minor version difference', () => {
			should(utils.comparePackageVersions(version1Revision, version1)).equal(1);
		});
	});

	describe('sortPackageVersions', () => {

		it('empty', () => {
			should(utils.sortPackageVersions([])).deepEqual([]);
		});

		it('single', () => {
			const single = ['1'];
			should(utils.sortPackageVersions(single)).deepEqual(single);
		});

		it('inorder', () => {
			const inorder = ['1', '2', '3'];
			should(utils.sortPackageVersions(inorder)).deepEqual(inorder);
		});

		it('inorder descending', () => {
			const inorder = ['1', '2', '3'];
			const inorderSortedDescending = ['3', '2', '1'];
			should(utils.sortPackageVersions(inorder, false)).deepEqual(inorderSortedDescending);
		});

		it('reverse order', () => {
			const reverseOrder = ['3', '2', '1'];
			const reverseOrderSorted = ['1', '2', '3'];
			should(utils.sortPackageVersions(reverseOrder)).deepEqual(reverseOrderSorted);
		});

		it('reverse order descending', () => {
			const reverseOrder = ['3', '2', '1'];
			const reverseOrderSortedDescending = ['3', '2', '1'];
			should(utils.sortPackageVersions(reverseOrder, false)).deepEqual(reverseOrderSortedDescending);
		});

		it('random', () => {
			const random = ['1', '42', '100', '0'];
			const randomSorted = ['0', '1', '42', '100'];
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});

		it('random descending', () => {
			const random = ['1', '42', '100', '0'];
			const randomSortedDescending = ['100', '42', '1', '0'];
			should(utils.sortPackageVersions(random, false)).deepEqual(randomSortedDescending);
		});

		it('different lengths', () => {
			const random = ['1.0.0', '42', '100.0', '0.1', '1.0.1'];
			const randomSorted = ['0.1', '1.0.0', '1.0.1', '42', '100.0'];
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});
	});

	describe('executeBufferedCommand', () => {

		it('runs successfully', async () => {
			await utils.executeBufferedCommand('echo hello', {}, new MockOutputChannel());
		});

		it('errors correctly with invalid command', async () => {
			await should(utils.executeBufferedCommand('invalidcommand', {}, new MockOutputChannel())).be.rejected();
		});
	});

	describe('executeStreamedCommand', () => {

		it('runs successfully', async () => {
			await utils.executeStreamedCommand('echo hello', {}, new MockOutputChannel());
		});

		it('errors correctly with invalid command', async () => {
			await should(utils.executeStreamedCommand('invalidcommand', {}, new MockOutputChannel())).be.rejected();
		});
	});

	describe('isEditorTitleFree', () => {
		afterEach(async () => {
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		});

		it('title is free', () => {
			should(utils.isEditorTitleFree('MyTitle')).be.true();
		});

		it('title is not free with text document sharing name', async () => {
			const editorTitle = 'Untitled-1';
			should(utils.isEditorTitleFree(editorTitle)).be.true('Title should be free before opening text document');
			await vscode.workspace.openTextDocument();
			should(utils.isEditorTitleFree(editorTitle)).be.false('Title should not be free after opening text document');
		});

		it('title is not free with notebook document sharing name', async () => {
			const editorTitle = 'MyUntitledNotebook';
			should(utils.isEditorTitleFree(editorTitle)).be.true('Title should be free before opening notebook');
			await azdata.nb.showNotebookDocument(vscode.Uri.parse(`untitled:${editorTitle}`));
			should(utils.isEditorTitleFree('MyUntitledNotebook')).be.false('Title should not be free after opening notebook');
		});

		it('title is not free with notebook document sharing name created through command', async () => {
			const editorTitle = 'Notebook-0';
			should(utils.isEditorTitleFree(editorTitle)).be.true('Title should be free before opening notebook');
			await vscode.commands.executeCommand('_notebook.command.new');
			should(utils.isEditorTitleFree(editorTitle)).be.false('Title should not be free after opening notebook');
		});
	});

	describe('getClusterEndpoints', () => {
		const baseServerInfo: azdata.ServerInfo = {
			serverMajorVersion: -1,
			serverMinorVersion: -1,
			serverReleaseVersion: -1,
			engineEditionId: -1,
			serverVersion: '',
			serverLevel: '',
			serverEdition: '',
			isCloud: false,
			azureVersion: -1,
			osVersion: '',
			options: {}
		};
		it('empty endpoints does not error', () => {
			const serverInfo = Object.assign({}, baseServerInfo);
			serverInfo.options['clusterEndpoints'] = [];
			should(utils.getClusterEndpoints(serverInfo).length).equal(0);
		});

		it('endpoints without endpoint field are created successfully', () => {
			const serverInfo = Object.assign({}, baseServerInfo);
			const ipAddress = 'localhost';
			const port = '123';
			serverInfo.options['clusterEndpoints'] = [{ ipAddress: ipAddress, port: port }];
			const endpoints = utils.getClusterEndpoints(serverInfo);
			should(endpoints.length).equal(1);
			should(endpoints[0].endpoint).equal('https://localhost:123');
		});

		it('endpoints with endpoint field are created successfully', () => {
			const endpoint = 'https://myActualEndpoint:8080';
			const serverInfo = Object.assign({}, baseServerInfo);
			serverInfo.options['clusterEndpoints'] = [{ endpoint: endpoint, ipAddress: 'localhost', port: '123' }];
			const endpoints = utils.getClusterEndpoints(serverInfo);
			should(endpoints.length).equal(1);
			should(endpoints[0].endpoint).equal(endpoint);
		});
	});

	describe('getHostAndPortFromEndpoint', () => {
		it('valid endpoint is parsed correctly', () => {
			const host = 'localhost';
			const port = '123';
			const hostAndIp = utils.getHostAndPortFromEndpoint(`https://${host}:${port}`);
			should(hostAndIp).deepEqual({ host: host, port: port });
		});

		it('invalid endpoint is returned as is', () => {
			const host = 'localhost';
			const hostAndIp = utils.getHostAndPortFromEndpoint(`https://${host}`);
			should(hostAndIp).deepEqual({ host: host, port: undefined });
		});
	});

	describe('exists', () => {
		it('runs as expected', async () => {
			const filename = path.join(os.tmpdir(), `NotebookUtilsTest_${uuid.v4()}`);
			try {
				should(await utils.exists(filename)).be.false();
				await fs.writeFile(filename, '');
				should(await utils.exists(filename)).be.true();
			} finally {
				try {
					await fs.unlink(filename);
				} catch { /* no-op */ }
			}
		});
	});

	describe('getIgnoreSslVerificationConfigSetting', () => {
		it('runs as expected', async () => {
			should(utils.getIgnoreSslVerificationConfigSetting()).be.true();
		});
	});

	describe('debounce', () => {
		class DebounceTest {
			public fnCalled = 0;
			public getterCalled = 0;

			@utils.debounce(100)
			fn(): void {
				this.fnCalled++;
			}

			@utils.debounce(100)
			get getter(): number {
				this.getterCalled++;
				return -1;
			}
		}

		it('decorates function correctly', async () => {
			const debounceTestObj = new DebounceTest();
			debounceTestObj.fn();
			debounceTestObj.fn();
			await sleep(500);
			should(debounceTestObj.fnCalled).equal(1);
			debounceTestObj.fn();
			debounceTestObj.fn();
			await sleep(500);
			should(debounceTestObj.fnCalled).equal(2);
		});

		it('decorates getter correctly', async () => {
			const debounceTestObj = new DebounceTest();
			let getterValue = debounceTestObj.getter;
			getterValue = debounceTestObj.getter;
			await sleep(500);
			should(debounceTestObj.getterCalled).equal(1);
			getterValue = debounceTestObj.getter;
			getterValue = debounceTestObj.getter;
			await sleep(500);
			should(debounceTestObj.getterCalled).equal(2);
			should(getterValue).be.undefined();
		});

		it('decorating setter not supported', async () => {
			should(() => {
				class UnsupportedTest {
					@utils.debounce(100)
					set setter(value: number) { }
				}
				new UnsupportedTest();
			}).throw();
		});
	});

	describe('getLinkBearerToken', () => {
		it('properly retrieves token for ADO with single account and tenant', async () => {
			let singleTenant: { displayName: string, id: string } = {
				displayName: 'Microsoft',
				id: 'tenantId'
			};
			let singleAccount: azdata.Account = {
				displayInfo: {
					accountType: 'any',
					contextualDisplayName: 'joberume@microsoft.com',
					displayName: 'joberume@microsoft.com',
					userId: 'id'
				},
				isStale: false,
				key: {
					accountId: 'accountId',
					providerId: 'providerId'
				},
				properties: {
					tenants: [singleTenant]
				}
			};
			let quickPickItem: utils.AccountQuickPickItem = new utils.AccountQuickPickItem(singleAccount);
			let accounts: azdata.Account[] = [singleAccount];
			let linkBearerToken: string = 'AAAAAAAAAAAAAAAAAAAAAMLheAAAAAAA0%2BuSeid';
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);

			mockApiWrapper.setup(api => api.getAllAccounts()).returns(() => Promise.resolve(accounts));
			mockApiWrapper.setup(api => api.getBearerToken(singleAccount, azdata.AzureResource.AzureDevOps)).returns(() => Promise.resolve({ [singleTenant.id]: { token: linkBearerToken } }));

			let accountQuickPickSetup = mockApiWrapper.setup(api => api.showQuickPick(TypeMoq.It.is((items: utils.AccountQuickPickItem[]) => items.length === 1 && items[0].account.key.accountId === singleAccount.key.accountId), TypeMoq.It.isAny(), TypeMoq.It.isAny()));
			accountQuickPickSetup.returns(() => Promise.resolve(quickPickItem));
			accountQuickPickSetup.verifiable();

			let retrievedBearerToken = await utils.getLinkBearerToken(azdata.AzureResource.AzureDevOps, mockApiWrapper.object);

			should(retrievedBearerToken).be.equal(linkBearerToken);

			// Verify that all the quick picks have taken place
			mockApiWrapper.verifyAll();
		});

		it('properly returns undefined token when no accounts are available', async () => {
			let accounts: azdata.Account[] = [];
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);

			mockApiWrapper.setup(api => api.getAllAccounts()).returns(() => Promise.resolve(accounts));

			let retrievedBearerToken = await utils.getLinkBearerToken(azdata.AzureResource.AzureDevOps, mockApiWrapper.object);

			should(retrievedBearerToken).be.equal('');
		});

		it('properly retrieves token for ADO with multiple tenants', async () => {
			let firstTenant: { displayName: string, id: string } = {
				displayName: 'Microsoft',
				id: 'tenantId'
			};
			let secondTenant: { displayName: string, id: string } = {
				displayName: 'Microsoft 2',
				id: 'tenantId2'
			};

			let firstAccount: azdata.Account = {
				displayInfo: {
					accountType: 'any',
					contextualDisplayName: 'joberume@microsoft.com',
					displayName: 'joberume@microsoft.com',
					userId: 'id'
				},
				isStale: false,
				key: {
					accountId: 'accountId',
					providerId: 'providerId'
				},
				properties: {
					tenants: [firstTenant, secondTenant]
				}
			};

			let accounts: azdata.Account[] = [firstAccount];
			let tenants: any[] = [firstTenant, secondTenant];
			let accountQuickPickItems: utils.AccountQuickPickItem[] = accounts.map(account => new utils.AccountQuickPickItem(account));
			let tenantQuickPickItems: utils.TenantQuickPickItem[] = tenants.map(tenant => new utils.TenantQuickPickItem(tenant));
			let firstLinkBearerToken: string = 'AAAAAAAAAAAAAAAAAAAAAMLheAAAAAAA0%2BuSeid';
			let secondLinkBearerToken: string = 'AAAAAAAAAAAAAAAAAAAAAMLheAAAAAAA0%2BuSeid';
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);

			mockApiWrapper.setup(api => api.getAllAccounts()).returns(() => Promise.resolve(accounts));
			mockApiWrapper.setup(api => api.getBearerToken(firstAccount, azdata.AzureResource.AzureDevOps)).returns(() => Promise.resolve({ [firstTenant.id]: { token: firstLinkBearerToken }, [secondTenant.id]: { token: secondLinkBearerToken } }));

			let accountQuickPickSetup = mockApiWrapper.setup(api => api.showQuickPick(TypeMoq.It.is((items: utils.AccountQuickPickItem[]) => items.length === 1 && items[0].account.key.accountId === firstAccount.key.accountId), TypeMoq.It.isAny(), TypeMoq.It.isAny()));
			accountQuickPickSetup.verifiable();
			accountQuickPickSetup.returns(() => Promise.resolve(accountQuickPickItems[0]));

			let tenantQuickPickSetup = mockApiWrapper.setup(api => api.showQuickPick(TypeMoq.It.is((items: utils.TenantQuickPickItem[]) => items.length === 2 && items[0].tenant.id === firstTenant.id && items[1].tenant.id === secondTenant.id), TypeMoq.It.isAny()));
			tenantQuickPickSetup.verifiable();
			tenantQuickPickSetup.returns(() => Promise.resolve(tenantQuickPickItems[1]));

			let firstRetrievedToken = await utils.getLinkBearerToken(azdata.AzureResource.AzureDevOps, mockApiWrapper.object);

			should(firstRetrievedToken).be.equal(secondLinkBearerToken);

			// Verify that all the quick picks have taken place
			mockApiWrapper.verifyAll();

		});

		it('properly retrieves token for ADO with multiple accounts', async () => {
			let firstTenant: { displayName: string, id: string } = {
				displayName: 'Microsoft',
				id: 'tenantId'
			};

			let secondTenant: { displayName: string, id: string } = {
				displayName: 'Microsoft 2',
				id: 'tenantId2'
			};

			let firstAccount: azdata.Account = {
				displayInfo: {
					accountType: 'any',
					contextualDisplayName: 'joberume@microsoft.com',
					displayName: 'joberume@microsoft.com',
					userId: 'id'
				},
				isStale: false,
				key: {
					accountId: 'accountId',
					providerId: 'providerId'
				},
				properties: {
					tenants: [firstTenant]
				}
			};

			let secondAccount: azdata.Account = {
				displayInfo: {
					accountType: 'any',
					contextualDisplayName: 'joberume@microsoft2.com',
					displayName: 'joberume@microsoft2.com',
					userId: 'id2'
				},
				isStale: false,
				key: {
					accountId: 'accountId2',
					providerId: 'providerId2'
				},
				properties: {
					tenants: [secondTenant]
				}
			};

			let accounts: azdata.Account[] = [firstAccount, secondAccount];
			let accountQuickPickItems: utils.AccountQuickPickItem[] = accounts.map(account => new utils.AccountQuickPickItem(account));
			let bearerToken: string = 'BBBBBBBBBBBBBBBBBBBBBMLheBBBBBBB0%2BuSeid';
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);

			mockApiWrapper.setup(api => api.getAllAccounts()).returns(() => Promise.resolve(accounts));

			let bearerTokenFetchSetup = mockApiWrapper.setup(api => api.getBearerToken(TypeMoq.It.isValue(secondAccount), TypeMoq.It.isValue(azdata.AzureResource.AzureDevOps)));
			bearerTokenFetchSetup.returns(() => Promise.resolve({ [secondTenant.id]: { token: bearerToken } }));
			bearerTokenFetchSetup.verifiable();

			let accountQuickPickSetup = mockApiWrapper.setup(api => api.showQuickPick(TypeMoq.It.is((items: utils.AccountQuickPickItem[]) => items.length === 2 && items[0].account.key.accountId === firstAccount.key.accountId && items[1].account.key.accountId === secondAccount.key.accountId), TypeMoq.It.isAny(), TypeMoq.It.isAny()));
			accountQuickPickSetup.returns(() => Promise.resolve(accountQuickPickItems[1]));
			accountQuickPickSetup.verifiable();

			let retrievedToken = await utils.getLinkBearerToken(azdata.AzureResource.AzureDevOps, mockApiWrapper.object);

			should(retrievedToken).be.equal(bearerToken);

			// Verify all the picks have happened
			mockApiWrapper.verifyAll();
		});
	});
});
