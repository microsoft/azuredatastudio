/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import * as TypeMoq from 'typemoq';
import { EventVerifierSingle } from 'sqltest/utils/eventVerifier';
import { Emitter } from 'vs/base/common/event';
import { AccountViewModel } from 'sql/parts/accountManagement/accountDialog/accountViewModel';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accountManagement/common/eventTypes';
import { AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';

// SUITE STATE /////////////////////////////////////////////////////////////
let mockAddProviderEmitter: Emitter<AccountProviderAddedEventParams>;
let mockRemoveProviderEmitter: Emitter<sqlops.AccountProviderMetadata>;
let mockUpdateAccountEmitter: Emitter<UpdateAccountListEventParams>;

let providers: sqlops.AccountProviderMetadata[];
let accounts: sqlops.Account[];

suite('Account Management Dialog ViewModel Tests', () => {

	suiteSetup(() => {
		providers = [{
			id: 'azure',
			displayName: 'Azure'
		}];

		let account1 = {
			key: { providerId: 'azure', accountId: 'account1' },
			name: 'Account 1',
			displayInfo: {
				contextualDisplayName: 'Microsoft Account',
				accountType: 'microsoft',
				displayName: 'Account 1'
			},
			properties: [],
			isStale: false
		};
		let account2 = {
			key: { providerId: 'azure', accountId: 'account2' },
			name: 'Account 2',
			displayInfo: {
				contextualDisplayName: 'Work/School Account',
				accountType: 'work_school',
				displayName: 'Account 2'
			},
			properties: [],
			isStale: true
		};
		accounts = [account1, account2];

		// Setup event mocks for the account management service
		mockAddProviderEmitter = new Emitter<AccountProviderAddedEventParams>();
		mockRemoveProviderEmitter = new Emitter<sqlops.AccountProviderMetadata>();
		mockUpdateAccountEmitter = new Emitter<UpdateAccountListEventParams>();
	});

	test('Construction - Events are properly defined', () => {
		// If: I create an account viewmodel
		let mockAccountManagementService = getMockAccountManagementService(false, false);
		let vm = new AccountViewModel(mockAccountManagementService.object);

		// Then:
		// ... All the events for the view models should be properly initialized
		assert.notEqual(vm.addProviderEvent, undefined);
		assert.notEqual(vm.removeProviderEvent, undefined);
		assert.notEqual(vm.updateAccountListEvent, undefined);

		// ... All the events should properly fire
		let argAddProvider: AccountProviderAddedEventParams = { addedProvider: providers[0], initialAccounts: [] };
		let evAddProvider = new EventVerifierSingle<AccountProviderAddedEventParams>();
		vm.addProviderEvent(evAddProvider.eventHandler);
		mockAddProviderEmitter.fire(argAddProvider);
		evAddProvider.assertFired(argAddProvider);

		let argRemoveProvider = providers[0];
		let evRemoveProvider = new EventVerifierSingle<sqlops.AccountProviderMetadata>();
		vm.removeProviderEvent(evRemoveProvider.eventHandler);
		mockRemoveProviderEmitter.fire(argRemoveProvider);
		evRemoveProvider.assertFired(argRemoveProvider);

		let argUpdateAccounts: UpdateAccountListEventParams = { providerId: providers[0].id, accountList: accounts };
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		vm.updateAccountListEvent(evUpdateAccounts.eventHandler);
		mockUpdateAccountEmitter.fire(argUpdateAccounts);
		evUpdateAccounts.assertFired(argUpdateAccounts);
	});

	test('Initialize - Success', done => {
		// Setup: Create a viewmodel with event handlers
		let mockAccountManagementService = getMockAccountManagementService(true, true);
		let evAddProvider = new EventVerifierSingle<AccountProviderAddedEventParams>();
		let evRemoveProvider = new EventVerifierSingle<sqlops.AccountProviderMetadata>();
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		let vm = getViewModel(mockAccountManagementService.object, evAddProvider, evRemoveProvider, evUpdateAccounts);

		// If: I initialize the view model
		vm.initialize()
			.then(results => {
				// Then:
				// ... None of the events should have fired
				assertNoEventsFired(evAddProvider, evRemoveProvider, evUpdateAccounts);

				// ... The account management service should have been called
				mockAccountManagementService.verify(x => x.getAccountProviderMetadata(), TypeMoq.Times.once());
				mockAccountManagementService.verify(x => x.getAccountsForProvider(TypeMoq.It.isAny()), TypeMoq.Times.once());

				// ... The results that were returned should be an array of account provider added event params
				assert.ok(Array.isArray(results));
				assert.equal(results.length, 1);
				assert.equal(results[0].addedProvider, providers[0]);
				assert.equal(results[0].initialAccounts, accounts);
			}).then(
			() => done(),
			err => done(err)
			);
	});

	test('Initialize - Get providers fails', done => {
		// Setup: Create a mock account management service that rejects looking up providers
		let mockAccountManagementService = getMockAccountManagementService(false, true);
		let evAddProvider = new EventVerifierSingle<AccountProviderAddedEventParams>();
		let evRemoveProvider = new EventVerifierSingle<sqlops.AccountProviderMetadata>();
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		let vm = getViewModel(mockAccountManagementService.object, evAddProvider, evRemoveProvider, evUpdateAccounts);

		// If: I initialize the view model
		vm.initialize()
			.then(results => {
				// Then
				// ... None of the events should have fired
				assertNoEventsFired(evAddProvider, evRemoveProvider, evUpdateAccounts);

				// ... The account management service should have been called for providers, but not accounts
				mockAccountManagementService.verify(x => x.getAccountProviderMetadata(), TypeMoq.Times.once());
				mockAccountManagementService.verify(x => x.getAccountsForProvider(TypeMoq.It.isAny()), TypeMoq.Times.never());

				// ... The results that were returned should be an empty array
				assert.ok(Array.isArray(results));
				assert.equal(results.length, 0);
			})
			.then(
			() => done(),
			err => done(err)
			);
	});

	test('Initialize - Get accounts fails', done => {
		// Setup: Create a mock account management service that rejects the promise
		let mockAccountManagementService = getMockAccountManagementService(true, false);
		let evAddProvider = new EventVerifierSingle<AccountProviderAddedEventParams>();
		let evRemoveProvider = new EventVerifierSingle<sqlops.AccountProviderMetadata>();
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		let vm = getViewModel(mockAccountManagementService.object, evAddProvider, evRemoveProvider, evUpdateAccounts);

		// If: I initialize the view model
		vm.initialize()
			.then(result => {
				// Then:
				// ... None of the events should have fired
				assertNoEventsFired(evAddProvider, evRemoveProvider, evUpdateAccounts);

				// ... The account management service should have been called
				mockAccountManagementService.verify(x => x.getAccountProviderMetadata(), TypeMoq.Times.once());
				mockAccountManagementService.verify(x => x.getAccountsForProvider(TypeMoq.It.isAny()), TypeMoq.Times.once());

				// ... The results should include the provider
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 1);
				assert.equal(result[0].addedProvider, providers[0]);
				assert.equal(result[0].initialAccounts, accounts);
			}).then(
			() => done(),
			err => done()
			);
	});
});

function getMockAccountManagementService(resolveProviders: boolean, resolveAccounts: boolean): TypeMoq.Mock<AccountManagementTestService> {
	let mockAccountManagementService = TypeMoq.Mock.ofType(AccountManagementTestService);

	mockAccountManagementService.setup(x => x.getAccountProviderMetadata())
		.returns(() => resolveProviders ? Promise.resolve(providers) : Promise.reject(null).then());
	mockAccountManagementService.setup(x => x.getAccountsForProvider(TypeMoq.It.isAny()))
		.returns(() => resolveAccounts ? Promise.resolve(accounts) : Promise.reject(null).then());

	mockAccountManagementService.setup(x => x.addAccountProviderEvent)
		.returns(() => mockAddProviderEmitter.event);
	mockAccountManagementService.setup(x => x.removeAccountProviderEvent)
		.returns(() => mockRemoveProviderEmitter.event);
	mockAccountManagementService.setup(x => x.updateAccountListEvent)
		.returns(() => mockUpdateAccountEmitter.event);

	return mockAccountManagementService;
}

function getViewModel(
	ams: AccountManagementTestService,
	evAdd: EventVerifierSingle<AccountProviderAddedEventParams>,
	evRemove: EventVerifierSingle<sqlops.AccountProviderMetadata>,
	evUpdate: EventVerifierSingle<UpdateAccountListEventParams>
): AccountViewModel {
	let vm = new AccountViewModel(ams);
	vm.addProviderEvent(evAdd.eventHandler);
	vm.removeProviderEvent(evRemove.eventHandler);
	vm.updateAccountListEvent(evUpdate.eventHandler);

	return vm;
}

function assertNoEventsFired(
	evAdd: EventVerifierSingle<AccountProviderAddedEventParams>,
	evRemove: EventVerifierSingle<sqlops.AccountProviderMetadata>,
	evUpdate: EventVerifierSingle<UpdateAccountListEventParams>
): void {
	evAdd.assertNotFired();
	evRemove.assertNotFired();
	evUpdate.assertNotFired();
}