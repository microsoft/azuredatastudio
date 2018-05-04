/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { EventVerifierSingle } from 'sqltest/utils/eventVerifier';
import { Emitter } from 'vs/base/common/event';
import { AccountPickerViewModel } from 'sql/parts/accountManagement/accountPicker/accountPickerViewModel';
import { UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';
import { AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';

// SUITE STATE /////////////////////////////////////////////////////////////
let mockUpdateAccountEmitter: Emitter<UpdateAccountListEventParams>;

let providers: sqlops.AccountProviderMetadata[];
let accounts: sqlops.Account[];
suite('Account picker view model tests', () => {
	setup(() => {
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
				accountType: 'microsoft',
				displayName: 'Account 2'
			},
			properties: [],
			isStale: true
		};
		accounts = [account1, account2];

		// Setup event mocks
		mockUpdateAccountEmitter = new Emitter<UpdateAccountListEventParams>();
	});

	test('Construction - Events are properly defined', () => {
		// If: I create an account picker viewmodel
		let mockAccountManagementService = getMockAccountManagementService(false, false);
		let vm = new AccountPickerViewModel('azure', mockAccountManagementService.object);

		// Then:
		// ... The event for the view models should be properly initialized
		assert.notEqual(vm.updateAccountListEvent, undefined);

		// ... The event should properly fire
		let argUpdateAccounts: UpdateAccountListEventParams = { providerId: providers[0].id, accountList: accounts };
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		vm.updateAccountListEvent(evUpdateAccounts.eventHandler);
		mockUpdateAccountEmitter.fire(argUpdateAccounts);
		evUpdateAccounts.assertFired(argUpdateAccounts);
	});

	test('Initialize - Success', done => {
		// Setup: Create a viewmodel with event handlers
		let mockAccountManagementService = getMockAccountManagementService(true, true);
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		let vm = getViewModel(mockAccountManagementService.object, evUpdateAccounts);

		// If: I initialize the view model
		vm.initialize()
			.then(results => {
				// Then:
				// ... None of the events should have fired
				evUpdateAccounts.assertNotFired();

				// ... The account management service should have been called
				mockAccountManagementService.verify(x => x.getAccountsForProvider(TypeMoq.It.isAny()), TypeMoq.Times.once());

				// ... The results that were returned should be an array of account
				assert.ok(Array.isArray(results));
				assert.equal(results.length, 2);
				assert.equal(results, accounts);
			}).then(
			() => done(),
			err => done(err)
			);
	});

	test('Initialize - Get accounts fails expects empty array', done => {
		// Setup: Create a mock account management service that rejects the promise
		let mockAccountManagementService = getMockAccountManagementService(true, false);
		let evUpdateAccounts = new EventVerifierSingle<UpdateAccountListEventParams>();
		let vm = getViewModel(mockAccountManagementService.object, evUpdateAccounts);

		// If: I initialize the view model
		vm.initialize()
			.then(result => {
				// Then:
				// ... None of the events should have fired
				evUpdateAccounts.assertNotFired();

				// ... The account management service should have been called
				mockAccountManagementService.verify(x => x.getAccountsForProvider(TypeMoq.It.isAny()), TypeMoq.Times.once());

				// ... The results should be an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
				assert.equal(result, []);
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

	mockAccountManagementService.setup(x => x.updateAccountListEvent)
		.returns(() => mockUpdateAccountEmitter.event);

	return mockAccountManagementService;
}

function getViewModel(
	ams: AccountManagementTestService,
	evUpdate: EventVerifierSingle<UpdateAccountListEventParams>
): AccountPickerViewModel {
	let vm = new AccountPickerViewModel('azure', ams);
	vm.updateAccountListEvent(evUpdate.eventHandler);

	return vm;
}
