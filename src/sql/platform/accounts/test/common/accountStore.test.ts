/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import AccountStore from 'sql/platform/accounts/common/accountStore';
import { EventVerifierSingle } from 'sql/base/test/common/event';
import { ConsoleLogService } from 'vs/platform/log/common/log';

const consoleLogService = new ConsoleLogService;
suite('Account Store Tests', () => {
	test('AddOrUpdate - Uninitialized memento', () => {
		// Setup: Create account store w/o initialized memento
		let memento: { [key: string]: azdata.Account[] } = {};
		let as = new AccountStore(memento, consoleLogService);

		// If: I add an account to the store
		return as.addOrUpdate(account1)
			.then(result => {
				// Then:
				// ... I should have gotten back a result indicating the account was added
				assert.ok(result.accountAdded);
				assert.ok(!result.accountModified);
				assertAccountEqual(result.changedAccount!, account1);

				// ... The memento should have been initialized and account added
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account1);
			});
	});

	test('AddOrUpdate - Adds to accounts', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento: { [key: string]: azdata.Account[] } = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento, consoleLogService);

		// If: I add an account to the store
		return as.addOrUpdate(account1)
			.then(result => {
				// Then:
				// ... I should have gotten back a result indicating the account was added
				assert.ok(result.accountAdded);
				assert.ok(!result.accountModified);
				assertAccountEqual(result.changedAccount!, account1);

				// ... The memento should have the account added
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account1);
			});
	});

	test('AddOrUpdate - Updates account', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento, consoleLogService);

		// If: I add an account to the store that already exists
		let param = <azdata.Account>{
			key: account2.key,
			displayInfo: account1.displayInfo,
			isStale: account1.isStale
		};
		return as.addOrUpdate(param)
			.then(result => {
				// Then:
				// ... I should have gotten back a result indicating the account was updated
				assert.ok(result.accountModified);
				assert.ok(!result.accountAdded);
				assertAccountEqual(result.changedAccount!, param);

				// ... The memento should have been initialized and account updated
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 2);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][1], param);
			});
	});

	test('GetAccountsByProvider - Uninitialized memento', () => {
		// Setup: Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts by provider
		return as.getAccountsByProvider('azure')
			.then(result => {
				// Then:
				// ... I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);

				// ... Memento should not have been written
				assert.equal(Object.keys(memento).length, 0);
			});
	});

	test('GetAccountsByProvider - No accounts', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento: { [key: string]: azdata.Account[] } = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts when there aren't any accounts
		return as.getAccountsByProvider('azure')
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			});
	});

	test('GetAccountsByProvider - Accounts, but no accounts for provider', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts by provider that doesn't have accounts
		return as.getAccountsByProvider('cloudycloud')
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			});
	});

	test('GetAccountsByProvider - Accounts for provider', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts by provider that has accounts
		return as.getAccountsByProvider('azure')
			.then(result => {
				// Then: I should get the accounts
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 2);
				assertAccountEqual(result[0], memento[AccountStore.MEMENTO_KEY][0]);
				assertAccountEqual(result[1], memento[AccountStore.MEMENTO_KEY][1]);
			});
	});

	test('GetAllAccounts - Uninitialized memento', () => {
		// Setup: Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts
		return as.getAllAccounts()
			.then(result => {
				// Then:
				// ... I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);

				// ... Memento should not have been written
				assert.equal(Object.keys(memento).length, 0);
			});
	});

	test('GetAllAccounts - No accounts', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento: { [key: string]: azdata.Account[] } = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts when there aren't any accounts
		return as.getAllAccounts()
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			});
	});

	test('GetAllAccounts - Accounts', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento, consoleLogService);

		// If: I get accounts
		return as.getAllAccounts()
			.then(result => {
				// Then: I should get the accounts
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 2);
				assertAccountEqual(result[0], memento[AccountStore.MEMENTO_KEY][0]);
				assertAccountEqual(result[1], memento[AccountStore.MEMENTO_KEY][1]);
			});
	});

	test('Remove - Uninitialized menento', () => {
		// Setup: Create account store w/o initialized memento
		let memento: { [key: string]: azdata.Account[] } = {};
		let as = new AccountStore(memento, consoleLogService);

		// If: I remove an account when there's an uninitialized memento
		return as.remove(account1.key)
			.then(result => {
				// Then:
				// ... I should get back false (no account removed)
				assert.ok(!result);

				// ... The memento should have been initialized
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);
			});
	});

	test('Remove - Account does not exist', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento: { [key: string]: azdata.Account[] } = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento, consoleLogService);

		// If: I remove an account that doesn't exist
		return as.remove({ providerId: 'cloudyCloud', accountId: 'testyTest' })
			.then(result => {
				// Then:
				// ... I should get back false (no account removed)
				assert.ok(!result);

				// ... The memento should still be empty
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);
			});
	});

	test('Remove - Account exists', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento, consoleLogService);

		// If: I remove an account that does exist
		return as.remove(account1.key)
			.then(result => {
				// Then:
				// ... I should get back true (account removed)
				assert.ok(result);

				// ... The memento should have removed the first account
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account2);
			});
	});

	test('Update - Uninitialized menento', () => {
		// Setup:
		// ... Create account store w/o initialized memento
		let memento: { [key: string]: azdata.Account[] } = {};
		let as = new AccountStore(memento, consoleLogService);

		// ... Create a callback that we can verify was called
		let updateCallback = new EventVerifierSingle<azdata.Account>();

		// If: I update an account
		return as.update(account1.key, updateCallback.eventHandler)
			.then(result => {
				// Then:
				// ... I should get back false (account did not change)
				assert.ok(!result);

				// ... The memento should have been initialized
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);

				// ... The callback shouldn't have been called
				updateCallback.assertNotFired();
			});
	});

	test('Update - Account does not exist', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento: { [key: string]: azdata.Account[] } = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento, consoleLogService);

		// ... Create a callback that we can verify was called
		let updateCallback = new EventVerifierSingle<azdata.Account>();

		// If: I update an account that doesn't exist
		return as.update({ accountId: 'testyTest', providerId: 'cloudyCloud' }, updateCallback.eventHandler)
			.then(result => {
				// Then:
				// ... I should get back false (account did not change)
				assert.ok(!result);

				// ... The memento should still be empty
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);

				// ... The callback shouldn't have been called
				updateCallback.assertNotFired();
			});
	});

	test('Update - Account exists', () => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento, consoleLogService);

		// ... Create a callback to update the account
		let newDisplayName = 'Display Name Changed!';
		let updateCallback = (arg: azdata.Account) => {
			arg.displayInfo.displayName = newDisplayName;
		};

		// If: I update an account that exists
		return as.update(account1.key, updateCallback)
			.then(result => {
				// Then:
				// ... I should get back true (account did change)
				assert.ok(result);

				// ... The memento still contains two accounts
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 2);

				// ... Account 1 should have been updated
				assert.equal(memento[AccountStore.MEMENTO_KEY][0].displayInfo.displayName, newDisplayName);

				// ... Account 2 should have stayed the same
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][1], account2);
			});
	});

	test('Remove - Deprecated Account', () => {
		let memento = getTestMemento();
		memento[AccountStore.MEMENTO_KEY].push(deprecatedAccount1, deprecatedAccount2);
		let as = new AccountStore(memento, consoleLogService);
		// We know that we have 4 accounts now
		assert.equal(memento[AccountStore.MEMENTO_KEY].length, 4);

		return as.getAllAccounts().then(accounts => {
			// After pruning we will have 2 accounts
			assert.equal(accounts.length, 2);
		});
	});

	// TODO: Test to make sure operations occur sequentially
});

// TODO: Reinstate contextual logo once UI changes are checked in
const account1 = <azdata.Account>{
	key: {
		providerId: 'azure',
		accountId: 'testAccount1'
	},
	displayInfo: {
		displayName: 'Test Account 1',
		accountType: 'test',
		contextualDisplayName: 'Azure Account'
	},
	isStale: false
};

const account2 = <azdata.Account>{
	key: {
		providerId: 'azure',
		accountId: 'testAccount2'
	},
	displayInfo: {
		displayName: 'Test Account 2',
		accountType: 'test',
		contextualDisplayName: 'Azure Account'
	},
	isStale: false
};

const deprecatedAccount1 = <azdata.Account>{
	key: {
		providerId: 'azurePublicCloud',
		accountId: 'testDeprecatedAccount1'
	},
	displayInfo: {
		displayName: 'Test Deprecated Account',
		accountType: 'test',
		contextualDisplayName: 'Azure Account'
	},
	isStale: false
};

const deprecatedAccount2 = <azdata.Account>{
	key: {
		providerId: 'azurePublicCloud',
		accountId: 'testDeprecatedAccount2'
	},
	displayInfo: {
		displayName: 'Test Deprecated Account 2',
		accountType: 'test',
		contextualDisplayName: 'Azure Account'
	},
	isStale: false
};

function getTestMemento() {
	let memento: { [key: string]: azdata.Account[] } = {};
	memento[AccountStore.MEMENTO_KEY] = [account1, account2];

	return memento;
}

function assertAccountEqual(a: azdata.Account, b: azdata.Account) {
	assert.equal(a.key.providerId, b.key.providerId);
	assert.equal(a.key.accountId, b.key.accountId);

	assert.equal(a.displayInfo.contextualDisplayName, b.displayInfo.contextualDisplayName);
	assert.equal(a.displayInfo.accountType, b.displayInfo.accountType);
	assert.equal(a.displayInfo.displayName, b.displayInfo.displayName);

	assert.equal(a.isStale, b.isStale);
}
