/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import * as TypeMoq from 'typemoq';
import { AccountProviderStub, AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';
import { ExtHostAccountManagement } from 'sql/workbench/api/node/extHostAccountManagement';
import { TestRPCProtocol } from 'vs/workbench/test/electron-browser/api/testRPCProtocol';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IRPCProtocol } from 'vs/workbench/services/extensions/node/proxyIdentifier';
import { SqlMainContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { MainThreadAccountManagement } from 'sql/workbench/api/node/mainThreadAccountManagement';
import { IAccountManagementService, AzureResource } from 'sql/platform/accountManagement/common/interfaces';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

const IRPCProtocol = createDecorator<IRPCProtocol>('rpcProtocol');

// SUITE STATE /////////////////////////////////////////////////////////////
let instantiationService: TestInstantiationService;
let mockAccountMetadata: sqlops.AccountProviderMetadata;
let mockAccount: sqlops.Account;
let threadService: TestRPCProtocol;

// TESTS ///////////////////////////////////////////////////////////////////
suite('ExtHostAccountManagement', () => {
	suiteSetup(() => {
		threadService = new TestRPCProtocol();
		const accountMgmtStub = new AccountManagementTestService();

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
	test('Clear - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I clear an account
		extHost.$clear(0, mockAccount.key)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.clear(TypeMoq.It.isValue(mockAccount.key)),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Clear - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I clear an account for a handle that doesn't exist
		// Then: It should fail
		extHost.$clear(1, mockAccount.key)
			.then(() => done('Clear succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.clear(TypeMoq.It.isAny()),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// INITIALIZE TESTS ////////////////////////////////////////////////////
	test('Initialize - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I initialize the provider
		extHost.$initialize(0, [mockAccount])
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.initialize(TypeMoq.It.isValue([mockAccount])),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Initialize - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I initialize for a handle that doesn't exist
		// Then: It should fail
		extHost.$initialize(1, [mockAccount])
			.then(() => done('Initialize succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.initialize(TypeMoq.It.isAny()),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// PROMPT TESTS ////////////////////////////////////////////////////////
	test('Prompt - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I prompt for an account
		extHost.$prompt(0)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.prompt(),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Prompt - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I prompt with a handle that doesn't exist
		// Then: It should fail
		extHost.$prompt(1)
			.then(() => done('Prompt succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.prompt(),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// REFRESH TESTS ///////////////////////////////////////////////////////
	test('Refresh - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I refresh an account
		extHost.$refresh(0, mockAccount)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.refresh(TypeMoq.It.isValue(mockAccount)),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Refresh - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I refresh an account for a handle that doesn't exist
		// Then: It should fail
		extHost.$refresh(1, mockAccount)
			.then(() => done('Refresh succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.refresh(TypeMoq.It.isAny()),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// GETALLACCOUNTS TESTS ///////////////////////////////////////////////////////
	test('GetAllAccounts - Success', (done) => {
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
				displayName: 'Azure Account 1'
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
				displayName: 'Azure Account 2'
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
		extHost.$getAllAccounts()
			.then((accounts) => {
				// Then: The call should have been passed to the account management service
				mockAccountManagementService.verify(
					(obj) => obj.getAccountsForProvider(TypeMoq.It.isAny()),
					TypeMoq.Times.once()
				);

				assert.ok(Array.isArray(accounts));
				assert.equal(accounts.length, expectedAccounts.length);
				assert.deepStrictEqual(accounts, expectedAccounts);
			})
			.then(() => done(), (err) => done(err));
	});

	test('GetAllAccounts - No account providers', (done) => {
		// Setup: Create ext host account management with no registered account providers
		let extHost = new ExtHostAccountManagement(threadService);

		// If: I get all accounts
		// Then: It should throw
		assert.throws(
			() => extHost.$getAllAccounts(),
			(error) => {
				return error.message === 'No account providers registered.';
			});
		done();
	});

	test('GetSecurityToken - Success', (done) => {
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
				displayName: 'Azure Account 1'
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

		extHost.$getAllAccounts()
			.then((accounts) => {
				// If: I get security token it will not throw
				return extHost.$getSecurityToken(mockAccount1, AzureResource.ResourceManagement);
			}
			).then(() => done(), (err) => done(new Error(err)));
	});

	test('GetSecurityToken - Account not found', (done) => {
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
				displayName: 'Azure Account 1'
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
				displayName: 'Azure Account 2'
			},
			properties: [],
			isStale: false
		};

		extHost.$getAllAccounts()
			.then(accounts => {
				return extHost.$getSecurityToken(mockAccount2, AzureResource.ResourceManagement);
			})
			.then((noError) => {
				done(new Error('Expected getSecurityToken to throw'));
			}, (err) => {
				// Expected error caught
				done();
			});
	});
});

function getMockAccountProvider(): TypeMoq.Mock<sqlops.AccountProvider> {
	let mock = TypeMoq.Mock.ofType<sqlops.AccountProvider>(AccountProviderStub);
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

function getMockAccountManagementService(accounts: sqlops.Account[]): TypeMoq.Mock<AccountManagementTestService> {
	let mockAccountManagementService = TypeMoq.Mock.ofType(AccountManagementTestService);

	mockAccountManagementService.setup(x => x.getAccountsForProvider(TypeMoq.It.isAny()))
		.returns(() => Promise.resolve(accounts));
	mockAccountManagementService.setup(x => x.getSecurityToken(TypeMoq.It.isValue(accounts[0]), TypeMoq.It.isAny()))
		.returns(() => Promise.resolve({}));
	mockAccountManagementService.setup(x => x.updateAccountListEvent)
		.returns(() => () => { return undefined; });

	return mockAccountManagementService;
}