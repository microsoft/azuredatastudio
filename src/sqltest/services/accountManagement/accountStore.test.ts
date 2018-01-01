/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import AccountStore from 'sql/services/accountManagement/accountStore';
import { EventVerifierSingle } from 'sqltest/utils/eventVerifier';

suite('Account Store Tests', () => {
	test('AddOrUpdate - Uninitialized memento', done => {
		// Setup: Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento);

		// If: I add an account to the store
		as.addOrUpdate(account1)
			.then(result => {
				// Then:
				// ... I should have gotten back a result indicating the account was added
				assert.ok(result.accountAdded);
				assert.ok(!result.accountModified);
				assertAccountEqual(result.changedAccount, account1);

				// ... The memento should have been initialized and account added
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account1);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('AddOrUpdate - Adds to accounts', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento);

		// If: I add an account to the store
		as.addOrUpdate(account1)
			.then(result => {
				// Then:
				// ... I should have gotten back a result indicating the account was added
				assert.ok(result.accountAdded);
				assert.ok(!result.accountModified);
				assertAccountEqual(result.changedAccount, account1);

				// ... The memento should have the account added
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account1);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('AddOrUpdate - Updates account', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento);

		// If: I add an account to the store that already exists
		let param = <sqlops.Account>{
			key: account2.key,
			displayInfo: account1.displayInfo,
			isStale: account1.isStale
		};
		as.addOrUpdate(param)
			.then(result => {
				// Then:
				// ... I should have gotten back a result indicating the account was updated
				assert.ok(result.accountModified);
				assert.ok(!result.accountAdded);
				assertAccountEqual(result.changedAccount, param);

				// ... The memento should have been initialized and account updated
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 2);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][1], param);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAccountsByProvider - Uninitialized memento', done => {
		// Setup: Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento);

		// If: I get accounts by provider
		as.getAccountsByProvider('azure')
			.then(result => {
				// Then:
				// ... I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);

				// ... Memento should not have been written
				assert.equal(Object.keys(memento).length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAccountsByProvider - No accounts', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento);

		// If: I get accounts when there aren't any accounts
		as.getAccountsByProvider('azure')
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAccountsByProvider - Accounts, but no accounts for provider', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento);

		// If: I get accounts by provider that doesn't have accounts
		as.getAccountsByProvider('cloudycloud')
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAccountsByProvider - Accounts for provider', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento);

		// If: I get accounts by provider that has accounts
		as.getAccountsByProvider('azure')
			.then(result => {
				// Then: I should get the accounts
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 2);
				assertAccountEqual(result[0], memento[AccountStore.MEMENTO_KEY][0]);
				assertAccountEqual(result[1], memento[AccountStore.MEMENTO_KEY][1]);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAllAccounts - Uninitialized memento', done => {
		// Setup: Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento);

		// If: I get accounts
		as.getAllAccounts()
			.then(result => {
				// Then:
				// ... I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);

				// ... Memento should not have been written
				assert.equal(Object.keys(memento).length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAllAccounts - No accounts', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento);

		// If: I get accounts when there aren't any accounts
		as.getAllAccounts()
			.then(result => {
				// Then: I should get back an empty array
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('GetAllAccounts - Accounts', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento);

		// If: I get accounts
		as.getAllAccounts()
			.then(result => {
				// Then: I should get the accounts
				assert.ok(Array.isArray(result));
				assert.equal(result.length, 2);
				assertAccountEqual(result[0], memento[AccountStore.MEMENTO_KEY][0]);
				assertAccountEqual(result[1], memento[AccountStore.MEMENTO_KEY][1]);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('Remove - Uninitialized menento', done => {
		// Setup: Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento);

		// If: I remove an account when there's an uninitialized memento
		as.remove(account1.key)
			.then(result => {
				// Then:
				// ... I should get back false (no account removed)
				assert.ok(!result);

				// ... The memento should have been initialized
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('Remove - Account does not exist', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento);

		// If: I remove an account that doesn't exist
		as.remove({ providerId: 'cloudyCloud', accountId: 'testyTest' })
			.then(result => {
				// Then:
				// ... I should get back false (no account removed)
				assert.ok(!result);

				// ... The memento should still be empty
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('Remove - Account exists', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento);

		// If: I remove an account that does exist
		as.remove(account1.key)
			.then(result => {
				// Then:
				// ... I should get back true (account removed)
				assert.ok(result);

				// ... The memento should have removed the first account
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 1);
				assertAccountEqual(memento[AccountStore.MEMENTO_KEY][0], account2);
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('Update - Uninitialized menento', done => {
		// Setup:
		// ... Create account store w/o initialized memento
		let memento = {};
		let as = new AccountStore(memento);

		// ... Create a callback that we can verify was called
		let updateCallback = new EventVerifierSingle<sqlops.Account>();

		// If: I update an account
		as.update(account1.key, updateCallback.eventHandler)
			.then(result => {
				// Then:
				// ... I should get back false (account did not change)
				assert.ok(!result);

				// ... The memento should have been initialized
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);

				// ... The callback shouldn't have been called
				updateCallback.assertNotFired();
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('Update - Account does not exist', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = {};
		memento[AccountStore.MEMENTO_KEY] = [];
		let as = new AccountStore(memento);

		// ... Create a callback that we can verify was called
		let updateCallback = new EventVerifierSingle<sqlops.Account>();

		// If: I update an account that doesn't exist
		as.update({ accountId: 'testyTest', providerId: 'cloudyCloud' }, updateCallback.eventHandler)
			.then(result => {
				// Then:
				// ... I should get back false (account did not change)
				assert.ok(!result);

				// ... The memento should still be empty
				assert.ok(Array.isArray(memento[AccountStore.MEMENTO_KEY]));
				assert.equal(memento[AccountStore.MEMENTO_KEY].length, 0);

				// ... The callback shouldn't have been called
				updateCallback.assertNotFired();
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	test('Update - Account exists', done => {
		// Setup: Create account store with initialized memento with accounts
		let memento = getTestMemento();
		let as = new AccountStore(memento);

		// ... Create a callback to update the account
		let newDisplayName = 'Display Name Changed!';
		let updateCallback = (arg: sqlops.Account) => {
			arg.displayInfo.displayName = newDisplayName;
		};

		// If: I update an account that exists
		as.update(account1.key, updateCallback)
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
			})
			.then(
			() => done(),
			e => done(e)
			);
	});

	// TODO: Test to make sure operations occur sequentially
});

// TODO: Reinstate contextual logo once UI changes are checked in
const account1 = <sqlops.Account>{
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

const account2 = <sqlops.Account>{
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

function getTestMemento() {
	let memento = {};
	memento[AccountStore.MEMENTO_KEY] = [account1, account2];

	return memento;
}

function assertAccountEqual(a: sqlops.Account, b: sqlops.Account) {
	assert.equal(a.key.providerId, b.key.providerId);
	assert.equal(a.key.accountId, b.key.accountId);

	assert.equal(a.displayInfo.contextualDisplayName, b.displayInfo.contextualDisplayName);
	assert.equal(a.displayInfo.accountType, b.displayInfo.accountType);
	assert.equal(a.displayInfo.displayName, b.displayInfo.displayName);

	assert.equal(a.isStale, b.isStale);
}
