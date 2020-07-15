/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import AccountStore from 'sql/platform/accounts/common/accountStore';
import { AccountDialogController } from 'sql/workbench/services/accountManagement/browser/accountDialogController';
import { AccountManagementService } from 'sql/workbench/services/accountManagement/browser/accountManagementService';
import { AccountAdditionResult, AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';
import { IAccountStore } from 'sql/platform/accounts/common/interfaces';
import { AccountProviderStub } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { EventVerifierSingle } from 'sql/base/test/common/event';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { AccountDialog } from 'sql/workbench/services/accountManagement/browser/accountDialog';
import { Emitter } from 'vs/base/common/event';

// SUITE CONSTANTS /////////////////////////////////////////////////////////
const hasAccountProvider: azdata.AccountProviderMetadata = {
	id: 'hasAccounts',
	displayName: 'Provider with Accounts'
};
const noAccountProvider: azdata.AccountProviderMetadata = {
	id: 'noAccounts',
	displayName: 'Provider without Accounts'
};

const account: azdata.Account = {
	key: {
		providerId: hasAccountProvider.id,
		accountId: 'testAccount1'
	},
	displayInfo: {
		displayName: 'Test Account 1',
		accountType: 'test',
		contextualDisplayName: 'Azure Account',
		userId: 'user@email.com'

	},
	isStale: false,
	properties: {}
};
const accountList: azdata.Account[] = [account];

suite('Account Management Service Tests:', () => {
	test('Constructor', () => {
		// If: I construct an account management service
		let ams = getTestState().accountManagementService;

		// Then:
		// ... It should be created successfully
		// ... Events should be available to register
		assert.ok(ams.addAccountProviderEvent);
		assert.ok(ams.removeAccountProviderEvent);
		assert.ok(ams.updateAccountListEvent);
	});

	test('Account Updated - account added', async () => {
		// Setup:
		// ... Create account management service and to mock up the store
		let state = getTestState();
		state.mockAccountStore.setup(x => x.addOrUpdate(TypeMoq.It.isAny()))
			.returns(account => Promise.resolve(<AccountAdditionResult>{
				accountModified: false,
				accountAdded: true,
				changedAccount: account
			}));
		state.mockAccountStore.setup(x => x.remove(TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(true));

		// ... Register a account provider with the management service
		let mockProvider = TypeMoq.Mock.ofType<azdata.AccountProvider>(AccountProviderStub);
		mockProvider.setup(x => x.clear(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		state.accountManagementService._providers[hasAccountProvider.id] = {
			accounts: [account],
			provider: mockProvider.object,
			metadata: hasAccountProvider
		};

		// If: I update an account that doesn't exist
		try {
			await state.accountManagementService.accountUpdated(account);
			assert.fail('Should have failed with new account being added');
		} catch (e) {
			state.mockAccountStore.verify(x => x.addOrUpdate(TypeMoq.It.isAny()), TypeMoq.Times.once());
			state.mockAccountStore.verify(x => x.remove(TypeMoq.It.isAny()), TypeMoq.Times.once());
		}
	});

	test('Account Updated - account modified', () => {
		// Setup:
		// ... Create account management service and to mock up the store
		let state = getTestState();
		state.mockAccountStore.setup(x => x.addOrUpdate(TypeMoq.It.isAny()))
			.returns(account => Promise.resolve(<AccountAdditionResult>{
				accountModified: true,
				accountAdded: false,
				changedAccount: account
			}));

		// ... Register a account provider with the management service
		let mockProvider = TypeMoq.Mock.ofType<azdata.AccountProvider>(AccountProviderStub);
		mockProvider.setup(x => x.clear(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		state.accountManagementService._providers[hasAccountProvider.id] = {
			accounts: [account],
			provider: mockProvider.object,
			metadata: hasAccountProvider
		};
		// If: I update an account that exists
		return state.accountManagementService.accountUpdated(account)
			.then(() => {
				// Then:
				// ... The mocked method was called
				state.mockAccountStore.verify(x => x.addOrUpdate(TypeMoq.It.isAny()), TypeMoq.Times.once());

				// ... The account list was updated
				state.eventVerifierUpdate.assertFiredWithVerify((params: UpdateAccountListEventParams) => {
					assert.equal(params.providerId, hasAccountProvider.id);
					assert.ok(Array.isArray(params.accountList));
					assert.equal(params.accountList.length, 1);
				});
			});
	});

	test('Add account - provider exists, account does not exist', () => {
		// Setup:
		// ... Create account management service with a provider
		let state = getTestState();
		let mockProvider = getMockAccountProvider();
		state.accountManagementService._providers[hasAccountProvider.id] = {
			accounts: [],
			provider: mockProvider.object,
			metadata: hasAccountProvider
		};

		// ... Add add/update handler to the account store that says account was new
		state.mockAccountStore.setup(x => x.addOrUpdate(TypeMoq.It.isValue(account)))
			.returns(() => Promise.resolve(<AccountAdditionResult>{
				accountModified: false,
				accountAdded: true,
				changedAccount: account
			}));

		// If: I ask to add an account
		return state.accountManagementService.addAccount(hasAccountProvider.id)
			.then(() => {
				// Then:
				// ... The provider should have been prompted
				mockProvider.verify(x => x.prompt(), TypeMoq.Times.once());

				// ... The account store should have added/updated
				state.mockAccountStore.verify(x => x.addOrUpdate(TypeMoq.It.isValue(account)), TypeMoq.Times.once());

				// ... The account list change should have been fired
				state.eventVerifierUpdate.assertFiredWithVerify(param => {
					assert.equal(param.providerId, hasAccountProvider.id);
					assert.ok(Array.isArray(param.accountList));
					assert.equal(param.accountList.length, 1);
					assert.equal(param.accountList[0], account);
				});
			});
	});

	test('Add account - provider exists, account exists', () => {
		// Setup:
		// ... Create account management service with a provider
		let state = getTestState();
		let mockProvider = getMockAccountProvider();
		state.accountManagementService._providers[hasAccountProvider.id] = {
			accounts: [account],
			provider: mockProvider.object,
			metadata: hasAccountProvider
		};

		// ... Add add/update handler to the account store that says account was not new
		state.mockAccountStore.setup(x => x.addOrUpdate(TypeMoq.It.isValue(account)))
			.returns(() => Promise.resolve(<AccountAdditionResult>{
				accountModified: true,
				accountAdded: false,
				changedAccount: account
			}));

		// If: I ask to add an account
		return state.accountManagementService.addAccount(hasAccountProvider.id)
			.then(() => {
				// Then:
				// ... The provider should have been prompted
				mockProvider.verify(x => x.prompt(), TypeMoq.Times.once());

				// ... The account store should have added/updated
				state.mockAccountStore.verify(x => x.addOrUpdate(TypeMoq.It.isValue(account)), TypeMoq.Times.once());

				// ... The account list change should have been fired
				state.eventVerifierUpdate.assertFiredWithVerify(param => {
					assert.equal(param.providerId, hasAccountProvider.id);
					assert.ok(Array.isArray(param.accountList));
					assert.equal(param.accountList.length, 1);
					assert.equal(param.accountList[0], account);
				});
			});
	});

	test('Add account - provider doesn\'t exist', () => {
		// Setup: Create account management service
		let ams = getTestState().accountManagementService;

		// If: I add an account when the provider doesn't exist
		// Then: It should not resolve
		return Promise.race([
			new Promise((resolve, reject) => setTimeout(() => resolve(), 100)),
			ams.addAccount('doesNotExist').then(() => { throw new Error('Promise resolved when the provider did not exist'); })
		]);
	});

	test('Add account - provider exists, provider fails', async () => {
		// Setup: Create account management service with a provider
		let state = getTestState();
		let mockProvider = getFailingMockAccountProvider(false);
		state.accountManagementService.registerProvider(noAccountProvider, mockProvider.object);

		// If: I ask to add an account and the user cancels
		// Then: Nothing should have happened and the promise should be resolved
		try {
			await state.accountManagementService.addAccount(noAccountProvider.id);
			assert.fail('Add account promise resolved when it should have rejected');
		} catch (e) { }
	});

	test('Add account - provider exists, user cancelled', () => {
		// Setup: Create account management service with a provider
		let state = getTestState();
		let mockProvider = getFailingMockAccountProvider(true);
		state.accountManagementService.registerProvider(noAccountProvider, mockProvider.object);

		// If: I ask to add an account and the user cancels
		// Then: Nothing should have happened and the promise should be resolved
		return state.accountManagementService.addAccount(noAccountProvider.id);
	});

	test('Get account provider metadata - providers exist', () => {
		// Setup: Create account management service with a provider
		let state = getTestState();
		state.accountManagementService._providers[noAccountProvider.id] = {
			accounts: [],
			provider: null,					// Doesn't matter
			metadata: noAccountProvider
		};

		// If: I ask for all the account provider metadata
		return state.accountManagementService.getAccountProviderMetadata()
			.then(result => {
				// Then: The list should have the one account provider in it
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 1);
				assert.equal(result[0], noAccountProvider);
			});
	});

	test('Get account provider metadata - no providers', () => {
		// Setup: Create account management service
		let ams = getTestState().accountManagementService;

		// If: I ask for account provider metadata when there isn't any providers
		return ams.getAccountProviderMetadata()
			.then(result => {
				// Then: The results should be an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			});
	});

	test('Get accounts by provider - provider does not exist', () => {
		// Setup: Create account management service
		let ams = getTestState().accountManagementService;

		// If: I get accounts when the provider doesn't exist
		// Then: It should not resolve
		return Promise.race([
			new Promise((resolve, reject) => setTimeout(() => resolve(), 100)),
			ams.getAccountsForProvider('doesNotExist').then(() => { throw new Error('Promise resolved when the provider did not exist'); })
		]);
	});

	test('Get accounts by provider - provider exists, no accounts', () => {
		// Setup: Create account management service
		let ams = getTestState().accountManagementService;
		ams._providers[noAccountProvider.id] = {
			accounts: [],
			provider: null,				// Doesn't matter
			metadata: noAccountProvider
		};

		// If: I ask for the accounts for a provider with no accounts
		return ams.getAccountsForProvider(noAccountProvider.id)
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			});
	});

	test('Get accounts by provider - provider exists, has accounts', () => {
		// Setup: Create account management service
		let ams = getTestState().accountManagementService;
		ams._providers[hasAccountProvider.id] = {
			accounts: [account],
			provider: null,				// Doesn't matter
			metadata: hasAccountProvider
		};

		// If: I ask for the accounts for a provider with accounts
		return ams.getAccountsForProvider(hasAccountProvider.id)
			.then(result => {
				// Then: I should get back the list of accounts
				assert.equal(result, accountList);
			});
	});

	test('Remove account - account exists', () => {
		// Setup:
		// ... Create account management service and to fake removing an account that exists
		let state = getTestState();
		state.mockAccountStore.setup(x => x.remove(TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(true));

		// ... Register a account provider with the management service
		let mockProvider = TypeMoq.Mock.ofType<azdata.AccountProvider>(AccountProviderStub);
		mockProvider.setup(x => x.clear(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		state.accountManagementService._providers[hasAccountProvider.id] = {
			accounts: [account],
			provider: mockProvider.object,
			metadata: hasAccountProvider
		};

		// If: I remove an account that exists
		return state.accountManagementService.removeAccount(account.key)
			.then(result => {
				// Then:
				// ... I should have gotten true back
				assert.ok(result);

				// ... The account store should have had remove called
				state.mockAccountStore.verify(x => x.remove(TypeMoq.It.isValue(account.key)), TypeMoq.Times.once());

				// ... The provider should have had clear called
				mockProvider.verify(x => x.clear(TypeMoq.It.isValue(account.key)), TypeMoq.Times.once());

				// ... The updated account list event should have fired
				state.eventVerifierUpdate.assertFiredWithVerify((params: UpdateAccountListEventParams) => {
					assert.equal(params.providerId, hasAccountProvider.id);
					assert.ok(Array.isArray(params.accountList));
					assert.equal(params.accountList.length, 0);
				});
			});
	});

	test('Remove account - account doesn\'t exist', () => {
		// Setup:
		// ... Create account management service and to fake removing an account that doesn't exist
		let state = getTestState();
		state.mockAccountStore.setup(x => x.remove(TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(false));

		// ... Register a account provider with the management service
		let mockProvider = getMockAccountProvider();
		mockProvider.setup(x => x.clear(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		state.accountManagementService._providers[noAccountProvider.id] = {
			accounts: [],
			provider: mockProvider.object,
			metadata: noAccountProvider
		};

		// If: I remove an account that doesn't exist
		let accountKey = { providerId: noAccountProvider.id, accountId: 'foobar' };
		return state.accountManagementService.removeAccount(accountKey)
			.then(result => {
				// Then:
				// ... I should have gotten false back
				assert.ok(!result);

				// ... The account store should have had remove called
				state.mockAccountStore.verify(x => x.remove(TypeMoq.It.isValue(accountKey)), TypeMoq.Times.once());

				// ... The provider should have had clear called
				mockProvider.verify(x => x.clear(TypeMoq.It.isValue(accountKey)), TypeMoq.Times.once());

				// ... The updated account list event should not have fired
				state.eventVerifierUpdate.assertNotFired();
			});
	});

	test('Open account dialog - first call', () => {
		// Setup:
		// ... Create account management ervice
		let state = getTestState();

		// ... Add mocking for instantiating an account dialog controller
		let mockDialogController = TypeMoq.Mock.ofType(AccountDialogController);
		let mockAccountDialog = {};
		mockDialogController.setup(x => x.openAccountDialog());
		mockDialogController.setup(x => x.accountDialog).returns(() => <AccountDialog>mockAccountDialog);
		let mockAccountDialogCloseEvent = new Emitter<void>();
		mockAccountDialog['onCloseEvent'] = mockAccountDialogCloseEvent.event;
		setTimeout(() => {
			mockAccountDialogCloseEvent.fire();
		}, 1000);
		state.instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountDialogController)))
			.returns(() => mockDialogController.object);

		// If: I open the account dialog when it doesn't exist
		return state.accountManagementService.openAccountListDialog()
			.then(() => {
				// Then:
				// ... The instantiation service should have been called once
				state.instantiationService.verify(x => x.createInstance(TypeMoq.It.isValue(AccountDialogController)), TypeMoq.Times.once());

				// ... The dialog should have been opened
				mockDialogController.verify(x => x.openAccountDialog(), TypeMoq.Times.once());
			});
	});

	test('Open account dialog - subsequent calls', () => {
		// Setup:
		// ... Create account management ervice
		let state = getTestState();

		// ... Add mocking for instantiating an account dialog controller
		let mockDialogController = TypeMoq.Mock.ofType(AccountDialogController);
		let mockAccountDialog = {};
		mockDialogController.setup(x => x.openAccountDialog());
		mockDialogController.setup(x => x.accountDialog).returns(() => <AccountDialog>mockAccountDialog);
		let mockAccountDialogCloseEvent = new Emitter<void>();
		mockAccountDialog['onCloseEvent'] = mockAccountDialogCloseEvent.event;
		setTimeout(() => {
			mockAccountDialogCloseEvent.fire();
		}, 1000);
		state.instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountDialogController)))
			.returns(() => mockDialogController.object);

		// If: I open the account dialog for a second time
		return state.accountManagementService.openAccountListDialog()
			.then(() => {
				setTimeout(() => {
					mockAccountDialogCloseEvent.fire();
				}, 1000);
				state.accountManagementService.openAccountListDialog();
			})
			.then(() => {
				// Then:
				// ... The instantiation service should have only been called once
				state.instantiationService.verify(x => x.createInstance(TypeMoq.It.isValue(AccountDialogController)), TypeMoq.Times.once());

				// ... The dialog should have been opened twice
				mockDialogController.verify(x => x.openAccountDialog(), TypeMoq.Times.exactly(2));
			});
	});

	// test('Perform oauth - success', done => {
	// TODO: implement this test properly once we remove direct IPC calls (see https://github.com/Microsoft/carbon/issues/2091)
	// });

	test('Register provider - success', () => {
		// Setup:
		// ... Create ams, account store that will accept account add/update
		let mocks = getTestState();
		mocks.mockAccountStore.setup(x => x.addOrUpdate(TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(undefined));

		// ... Create mock account provider
		let mockProvider = getMockAccountProvider();

		// If: I register a new provider
		return mocks.accountManagementService.registerProvider(noAccountProvider, mockProvider.object)
			.then(() => {
				// Then:
				// ... Account store should have been called to get dehydrated accounts
				mocks.mockAccountStore.verify(x => x.getAccountsByProvider(TypeMoq.It.isValue(noAccountProvider.id)), TypeMoq.Times.once());

				// ... The provider should have been initialized
				mockProvider.verify(x => x.initialize(TypeMoq.It.isAny()), TypeMoq.Times.once());

				// ... The provider added event should have fired
				mocks.eventVerifierProviderAdded.assertFiredWithVerify((param: AccountProviderAddedEventParams) => {
					assert.equal(param.addedProvider, noAccountProvider);
					assert.ok(Array.isArray(param.initialAccounts));
					assert.equal(param.initialAccounts.length, 0);
				});
			});
	});

	test('Unregister provider - success', () => {
		// Setup:
		// ... Create ams
		let mocks = getTestState();

		// ... Register a provider to remove
		let mockProvider = getMockAccountProvider();
		return mocks.accountManagementService.registerProvider(noAccountProvider, mockProvider.object)
			.then((success) => {
				// If: I remove an account provider
				mocks.accountManagementService.unregisterProvider(noAccountProvider);

				// Then: The provider removed event should have fired
				mocks.eventVerifierProviderRemoved.assertFired(noAccountProvider);
			});

	});
});

function getTestState(): AccountManagementState {
	// Create mock account store
	let mockAccountStore = TypeMoq.Mock.ofType<IAccountStore>(AccountStore);
	mockAccountStore.setup(x => x.getAccountsByProvider(TypeMoq.It.isValue(noAccountProvider.id)))
		.returns(() => Promise.resolve([]));
	mockAccountStore.setup(x => x.getAccountsByProvider(TypeMoq.It.isValue(hasAccountProvider.id)))
		.returns(() => Promise.resolve(accountList));

	// Create instantiation service
	let mockInstantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
	mockInstantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountStore), TypeMoq.It.isAny()))
		.returns(() => mockAccountStore.object);

	// Create mock memento
	let mockMemento = {};

	const testNotificationService = new TestNotificationService();

	// Create the account management service
	let ams = new AccountManagementService(mockMemento, mockInstantiationService.object, new TestStorageService(), null, null, undefined, testNotificationService);

	// Wire up event handlers
	let evUpdate = new EventVerifierSingle<UpdateAccountListEventParams>();
	let evAddProvider = new EventVerifierSingle<AccountProviderAddedEventParams>();
	let evRemoveProvider = new EventVerifierSingle<azdata.AccountProviderMetadata>();
	ams.updateAccountListEvent(evUpdate.eventHandler);
	ams.addAccountProviderEvent(evAddProvider.eventHandler);
	ams.removeAccountProviderEvent(evRemoveProvider.eventHandler);

	// Create the account management service
	return {
		accountManagementService: ams,
		instantiationService: mockInstantiationService,
		mockAccountStore: mockAccountStore,
		eventVerifierUpdate: evUpdate,
		eventVerifierProviderAdded: evAddProvider,
		eventVerifierProviderRemoved: evRemoveProvider
	};
}

function getMockAccountProvider(): TypeMoq.Mock<azdata.AccountProvider> {
	let mockProvider = TypeMoq.Mock.ofType<azdata.AccountProvider>(AccountProviderStub);
	mockProvider.setup(x => x.clear(TypeMoq.It.isAny())).returns(() => Promise.resolve());
	mockProvider.setup(x => x.initialize(TypeMoq.It.isAny())).returns(param => Promise.resolve(param));
	mockProvider.setup(x => x.prompt()).returns(() => Promise.resolve(account));

	return mockProvider;
}

function getFailingMockAccountProvider(cancel: boolean): TypeMoq.Mock<azdata.AccountProvider> {
	let mockProvider = TypeMoq.Mock.ofType<azdata.AccountProvider>(AccountProviderStub);
	mockProvider.setup(x => x.clear(TypeMoq.It.isAny()))
		.returns(() => Promise.resolve());
	mockProvider.setup(x => x.initialize(TypeMoq.It.isAny()))
		.returns(param => Promise.resolve(param));
	mockProvider.setup(x => x.prompt())
		.returns(() => {
			return cancel
				? Promise.resolve(<azdata.PromptFailedResult>{ canceled: true }).then()
				: Promise.reject(new Error()).then();
		});
	mockProvider.setup(x => x.refresh(TypeMoq.It.isAny()))
		.returns(() => {
			return cancel
				? Promise.resolve(<azdata.PromptFailedResult>{ canceled: true }).then()
				: Promise.reject(new Error()).then();
		});
	return mockProvider;
}

interface AccountManagementState {
	accountManagementService: AccountManagementService;
	instantiationService: TypeMoq.Mock<InstantiationService>;
	mockAccountStore: TypeMoq.Mock<IAccountStore>;
	eventVerifierUpdate: EventVerifierSingle<UpdateAccountListEventParams>;
	eventVerifierProviderAdded: EventVerifierSingle<AccountProviderAddedEventParams>;
	eventVerifierProviderRemoved: EventVerifierSingle<azdata.AccountProviderMetadata>;
}
