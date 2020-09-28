/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { AccountProviderStub, TestAccountManagementService } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { ExtHostAccountManagement } from 'sql/workbench/api/common/extHostAccountManagement';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IRPCProtocol } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { MainThreadAccountManagement } from 'sql/workbench/api/browser/mainThreadAccountManagement';
import { IAccountManagementService, AzureResource } from 'sql/platform/accounts/common/interfaces';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TestRPCProtocol } from 'vs/workbench/test/browser/api/testRPCProtocol';

const IRPCProtocol = createDecorator<IRPCProtocol>('rpcProtocol');

// SUITE STATE /////////////////////////////////////////////////////////////
let instantiationService: TestInstantiationService;
let mockAccountMetadata: azdata.AccountProviderMetadata;
let mockAccount: azdata.Account;
let threadService: TestRPCProtocol;

// TESTS ///////////////////////////////////////////////////////////////////
suite('ExtHostAccountManagement', () => {
	suiteSetup(() => {
		threadService = new TestRPCProtocol();
		const accountMgmtStub = new TestAccountManagementService();

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IRPCProtocol, threadService);
		instantiationService.stub(IAccountManagementService, accountMgmtStub);

		const accountMgmtService = instantiationService.createInstance(MainThreadAccountManagement, undefined);
		threadService.set(SqlMainContext.MainThreadAccountManagement, accountMgmtService);

		mockAccountMetadata = {
			args: {},
			displayName: 'Test Account Provider',
			id: 'test_account_provider',
			settings: {}
		};
		mockAccount = {
			key: {
				providerId: mockAccountMetadata.id,
				providerArgs: {},
				accountId: 'test_account'
			},
			properties: {},
			displayInfo: {
				displayName: 'Test Account',
				userId: 'user@email.com',
				contextualDisplayName: 'Test Kind Of Account',
				accountType: 'test'
			},
			isStale: false
		};
	});

	test('Constructor', () => {
		// If: I construct a new extension host account management
		let extHost = new ExtHostAccountManagement(threadService);

		// Then: There shouldn't be any account providers registered
		assert.equal(extHost.getProviderCount(), 0);
	});

	// REGISTER TESTS //////////////////////////////////////////////////////
	test('Register Account Provider - Success', () => {
		// Setup: Create an extension host account management
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();

		// If: I register a mock account provider
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// Then: The account provider should be registered
		assert.equal(extHost.getProviderCount(), 1);
	});

	test('Register Account Provider - Account Provider Already Registered', () => {
		// Setup: Create an extension host account management and register an account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I register an account provider again
		// Then
		// ... It should throw
		assert.throws(() => {
			extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);
		});

		// ... There should only be one account provider
		assert.equal(extHost.getProviderCount(), 1);
	});

	// TODO: Test for unregistering a provider

	// CLEAR TESTS /////////////////////////////////////////////////////////
	test('Clear - Success', () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I clear an account
		return extHost.$clear(0, mockAccount.key)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.clear(TypeMoq.It.isValue(mockAccount.key)),
					TypeMoq.Times.once()
				);
			});
	});

	test('Clear - Handle does not exist', async () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I clear an account for a handle that doesn't exist
		// Then: It should fail
		try {
			await extHost.$clear(1, mockAccount.key);
			assert.fail('Clear succeeded when it should have failed');
		} catch (e) {
			// The provider's clear should not have been called
			mockProvider.verify(
				(obj) => obj.clear(TypeMoq.It.isAny()),
				TypeMoq.Times.never()
			);
		}
	});

	// INITIALIZE TESTS ////////////////////////////////////////////////////
	test('Initialize - Success', () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I initialize the provider
		return extHost.$initialize(0, [mockAccount])
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.initialize(TypeMoq.It.isValue([mockAccount])),
					TypeMoq.Times.once()
				);
			});
	});

	test('Initialize - Handle does not exist', async () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I initialize for a handle that doesn't exist
		// Then: It should fail
		try {
			await extHost.$initialize(1, [mockAccount]);
			assert.fail('Initialize succeeded when it should have failed');
		} catch (e) {
			// The provider's clear should not have been called
			mockProvider.verify(
				(obj) => obj.initialize(TypeMoq.It.isAny()),
				TypeMoq.Times.never()
			);
		}
	});

	// PROMPT TESTS ////////////////////////////////////////////////////////
	test('Prompt - Success', () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I prompt for an account
		return extHost.$prompt(0)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.prompt(),
					TypeMoq.Times.once()
				);
			});
	});

	test('Prompt - Handle does not exist', async () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I prompt with a handle that doesn't exist
		// Then: It should fail
		try {
			await extHost.$prompt(1);
			assert.fail('Prompt succeeded when it should have failed');
		} catch (e) {
			// The provider's clear should not have been called
			mockProvider.verify(
				(obj) => obj.prompt(),
				TypeMoq.Times.never()
			);
		}
	});

	// REFRESH TESTS ///////////////////////////////////////////////////////
	test('Refresh - Success', () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I refresh an account
		return extHost.$refresh(0, mockAccount)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.refresh(TypeMoq.It.isValue(mockAccount)),
					TypeMoq.Times.once()
				);
			});
	});

	test('Refresh - Handle does not exist', async () => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I refresh an account for a handle that doesn't exist
		// Then: It should fail
		try {
			await extHost.$refresh(1, mockAccount);
			assert.fail('Refresh succeeded when it should have failed');
		} catch (e) {
			// The provider's clear should not have been called
			mockProvider.verify(
				(obj) => obj.refresh(TypeMoq.It.isAny()),
				TypeMoq.Times.never()
			);
		}
	});

	// GETALLACCOUNTS TESTS ///////////////////////////////////////////////////////
	test('GetAllAccounts - Success', () => {
		let mockAccountProviderMetadata = {
			id: 'azure',
			displayName: 'Azure'
		};

		let mockAccount1 = {
			key: {
				providerId: mockAccountProviderMetadata.id,
				accountId: 'azure_account_1'
			},
			displayInfo: {
				contextualDisplayName: 'Microsoft Account',
				accountType: 'microsoft',
				displayName: 'Azure Account 1',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};
		let mockAccount2 = {
			key: {
				providerId: mockAccountProviderMetadata.id,
				accountId: 'azure_account_2'
			},
			displayInfo: {
				contextualDisplayName: 'Work/School Account',
				accountType: 'microsoft',
				displayName: 'Azure Account 2',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};
		let mockAccounts = [mockAccount1, mockAccount2];

		let expectedAccounts = [mockAccount1, mockAccount2];

		let mockAccountManagementService = getMockAccountManagementService(mockAccounts);
		instantiationService.stub(IAccountManagementService, mockAccountManagementService.object);
		let accountManagementService = instantiationService.createInstance(MainThreadAccountManagement, undefined);
		threadService.set(SqlMainContext.MainThreadAccountManagement, accountManagementService);

		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		extHost.$registerAccountProvider(mockAccountProviderMetadata, new AccountProviderStub());

		// If: I get all accounts
		return extHost.$getAllAccounts()
			.then((accounts) => {
				// Then: The call should have been passed to the account management service
				mockAccountManagementService.verify(
					(obj) => obj.getAccountsForProvider(TypeMoq.It.isAny()),
					TypeMoq.Times.once()
				);

				assert.ok(Array.isArray(accounts));
				assert.equal(accounts.length, expectedAccounts.length);
				assert.deepStrictEqual(accounts, expectedAccounts);
			});
	});

	test('GetAllAccounts - No account providers', async () => {
		// Setup: Create ext host account management with no registered account providers
		let extHost = new ExtHostAccountManagement(threadService);

		// If: I get all accounts
		// Then: It should throw
		try {
			await extHost.$getAllAccounts();
			assert.fail('Succedded when should have failed');
		} catch (e) {
			assert(e.message === 'No account providers registered.');
		}
	});

	test('GetSecurityToken - Success', () => {
		let mockAccountProviderMetadata = {
			id: 'azure',
			displayName: 'Azure'
		};

		let mockAccount1 = {
			key: {
				providerId: mockAccountProviderMetadata.id,
				accountId: 'azure_account_1'
			},
			displayInfo: {
				contextualDisplayName: 'Microsoft Account',
				accountType: 'microsoft',
				displayName: 'Azure Account 1',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};
		let mockAccounts = [mockAccount1];

		let mockAccountManagementService = getMockAccountManagementService(mockAccounts);
		instantiationService.stub(IAccountManagementService, mockAccountManagementService.object);
		let accountManagementService = instantiationService.createInstance(MainThreadAccountManagement, undefined);
		threadService.set(SqlMainContext.MainThreadAccountManagement, accountManagementService);

		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		extHost.$registerAccountProvider(mockAccountProviderMetadata, new AccountProviderStub());

		return extHost.$getAllAccounts()
			.then((accounts) => {
				// If: I get security token it will not throw
				return extHost.$getSecurityToken(mockAccount1, AzureResource.ResourceManagement);
			});
	});

	test('GetSecurityToken - Account not found', async () => {
		let mockAccountProviderMetadata = {
			id: 'azure',
			displayName: 'Azure'
		};

		let mockAccount1 = {
			key: {
				providerId: mockAccountProviderMetadata.id,
				accountId: 'azure_account_1'
			},
			displayInfo: {
				contextualDisplayName: 'Microsoft Account',
				accountType: 'microsoft',
				displayName: 'Azure Account 1',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};
		let mockAccounts = [mockAccount1];

		let mockAccountManagementService = getMockAccountManagementService(mockAccounts);
		instantiationService.stub(IAccountManagementService, mockAccountManagementService.object);
		let accountManagementService = instantiationService.createInstance(MainThreadAccountManagement, undefined);
		threadService.set(SqlMainContext.MainThreadAccountManagement, accountManagementService);

		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		extHost.$registerAccountProvider(mockAccountProviderMetadata, new AccountProviderStub());

		let mockAccount2 = {
			key: {
				providerId: mockAccountProviderMetadata.id,
				accountId: 'azure_account_2'
			},
			displayInfo: {
				contextualDisplayName: 'Work/School Account',
				accountType: 'microsoft',
				displayName: 'Azure Account 2',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};

		await extHost.$getAllAccounts();
		try {
			await extHost.$getSecurityToken(mockAccount2, AzureResource.ResourceManagement);
			assert.fail('Expected getSecurityToken to throw');
		} catch (e) { }
	});
});

function getMockAccountProvider(): TypeMoq.Mock<azdata.AccountProvider> {
	let mock = TypeMoq.Mock.ofType<azdata.AccountProvider>(AccountProviderStub);
	mock.setup((obj) => obj.clear(TypeMoq.It.isValue(mockAccount.key)))
		.returns(() => Promise.resolve(undefined));
	mock.setup((obj) => obj.refresh(TypeMoq.It.isValue(mockAccount)))
		.returns(() => Promise.resolve(undefined));
	mock.setup((obj) => obj.initialize(TypeMoq.It.isValue([mockAccount])))
		.returns(() => Promise.resolve(undefined));
	mock.setup((obj) => obj.prompt())
		.returns(() => Promise.resolve(undefined));

	return mock;
}

function getMockAccountManagementService(accounts: azdata.Account[]): TypeMoq.Mock<TestAccountManagementService> {
	let mockAccountManagementService = TypeMoq.Mock.ofType(TestAccountManagementService);

	mockAccountManagementService.setup(x => x.getAccountsForProvider(TypeMoq.It.isAny()))
		.returns(() => Promise.resolve(accounts));
	mockAccountManagementService.setup(x => x.getSecurityToken(TypeMoq.It.isValue(accounts[0]), TypeMoq.It.isAny()))
		.returns(() => Promise.resolve({}));
	mockAccountManagementService.setup(x => x.getAccountSecurityToken(TypeMoq.It.isValue(accounts[0]), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
		.returns(() => Promise.resolve(undefined));
	mockAccountManagementService.setup(x => x.updateAccountListEvent)
		.returns(() => () => { return undefined; });

	return mockAccountManagementService;
}
