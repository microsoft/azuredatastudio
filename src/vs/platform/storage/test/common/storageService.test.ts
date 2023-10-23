/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, ok, strictEqual } from 'assert';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { InMemoryStorageService, IStorageService, IStorageTargetChangeEvent, IStorageValueChangeEvent, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

export function createSuite<T extends IStorageService>(params: { setup: () => Promise<T>; teardown: (service: T) => Promise<void> }): void {

	let storageService: T;

	setup(async () => {
		storageService = await params.setup();
	});

	teardown(() => {
		return params.teardown(storageService);
	});

	test('Get Data, Integer, Boolean (application)', () => {
		storeData(StorageScope.APPLICATION);
	});

	test('Get Data, Integer, Boolean (profile)', () => {
		storeData(StorageScope.PROFILE);
	});

	test('Get Data, Integer, Boolean, Object (workspace)', () => {
		storeData(StorageScope.WORKSPACE);
	});

	test('Storage change source', () => {
		const storageValueChangeEvents: IStorageValueChangeEvent[] = [];
		storageService.onDidChangeValue(StorageScope.WORKSPACE, undefined, new DisposableStore())(e => storageValueChangeEvents.push(e));

		// Explicit external source
		storageService.storeAll([{ key: 'testExternalChange', value: 'foobar', scope: StorageScope.WORKSPACE, target: StorageTarget.MACHINE }], true);
		let storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'testExternalChange');
		strictEqual(storageValueChangeEvent?.external, true);

		// Default source
		storageService.storeAll([{ key: 'testChange', value: 'barfoo', scope: StorageScope.WORKSPACE, target: StorageTarget.MACHINE }], false);
		storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'testChange');
		strictEqual(storageValueChangeEvent?.external, false);

		storageService.store('testChange', 'foobar', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'testChange');
		strictEqual(storageValueChangeEvent?.external, false);
	});

	test('Storage change event scope (all keys)', () => {
		const storageValueChangeEvents: IStorageValueChangeEvent[] = [];
		storageService.onDidChangeValue(StorageScope.WORKSPACE, undefined, new DisposableStore())(e => storageValueChangeEvents.push(e));

		storageService.store('testChange', 'foobar', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		storageService.store('testChange2', 'foobar', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		storageService.store('testChange', 'foobar', StorageScope.APPLICATION, StorageTarget.MACHINE);
		storageService.store('testChange', 'foobar', StorageScope.PROFILE, StorageTarget.MACHINE);
		storageService.store('testChange2', 'foobar', StorageScope.PROFILE, StorageTarget.MACHINE);
		strictEqual(storageValueChangeEvents.length, 2);
	});

	test('Storage change event scope (specific key)', () => {
		const storageValueChangeEvents: IStorageValueChangeEvent[] = [];
		storageService.onDidChangeValue(StorageScope.WORKSPACE, 'testChange', new DisposableStore())(e => storageValueChangeEvents.push(e));

		storageService.store('testChange', 'foobar', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		storageService.store('testChange', 'foobar', StorageScope.PROFILE, StorageTarget.USER);
		storageService.store('testChange', 'foobar', StorageScope.APPLICATION, StorageTarget.MACHINE);
		storageService.store('testChange2', 'foobar', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		const storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'testChange');
		ok(storageValueChangeEvent);
		strictEqual(storageValueChangeEvents.length, 1);
	});

	function storeData(scope: StorageScope): void {
		let storageValueChangeEvents: IStorageValueChangeEvent[] = [];
		storageService.onDidChangeValue(scope, undefined, new DisposableStore())(e => storageValueChangeEvents.push(e));

		strictEqual(storageService.get('test.get', scope, 'foobar'), 'foobar');
		strictEqual(storageService.get('test.get', scope, ''), '');
		strictEqual(storageService.getNumber('test.getNumber', scope, 5), 5);
		strictEqual(storageService.getNumber('test.getNumber', scope, 0), 0);
		strictEqual(storageService.getBoolean('test.getBoolean', scope, true), true);
		strictEqual(storageService.getBoolean('test.getBoolean', scope, false), false);
		deepStrictEqual(storageService.getObject('test.getObject', scope, { 'foo': 'bar' }), { 'foo': 'bar' });
		deepStrictEqual(storageService.getObject('test.getObject', scope, {}), {});
		deepStrictEqual(storageService.getObject('test.getObject', scope, []), []);

		storageService.store('test.get', 'foobar', scope, StorageTarget.MACHINE);
		strictEqual(storageService.get('test.get', scope, (undefined)!), 'foobar');
		let storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'test.get');
		strictEqual(storageValueChangeEvent?.scope, scope);
		strictEqual(storageValueChangeEvent?.key, 'test.get');
		storageValueChangeEvents = [];

		storageService.store('test.get', '', scope, StorageTarget.MACHINE);
		strictEqual(storageService.get('test.get', scope, (undefined)!), '');
		storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'test.get');
		strictEqual(storageValueChangeEvent!.scope, scope);
		strictEqual(storageValueChangeEvent!.key, 'test.get');

		storageService.store('test.getNumber', 5, scope, StorageTarget.MACHINE);
		strictEqual(storageService.getNumber('test.getNumber', scope, (undefined)!), 5);

		storageService.store('test.getNumber', 0, scope, StorageTarget.MACHINE);
		strictEqual(storageService.getNumber('test.getNumber', scope, (undefined)!), 0);

		storageService.store('test.getBoolean', true, scope, StorageTarget.MACHINE);
		strictEqual(storageService.getBoolean('test.getBoolean', scope, (undefined)!), true);

		storageService.store('test.getBoolean', false, scope, StorageTarget.MACHINE);
		strictEqual(storageService.getBoolean('test.getBoolean', scope, (undefined)!), false);

		storageService.store('test.getObject', {}, scope, StorageTarget.MACHINE);
		deepStrictEqual(storageService.getObject('test.getObject', scope, (undefined)!), {});

		storageService.store('test.getObject', [42], scope, StorageTarget.MACHINE);
		deepStrictEqual(storageService.getObject('test.getObject', scope, (undefined)!), [42]);

		storageService.store('test.getObject', { 'foo': {} }, scope, StorageTarget.MACHINE);
		deepStrictEqual(storageService.getObject('test.getObject', scope, (undefined)!), { 'foo': {} });

		strictEqual(storageService.get('test.getDefault', scope, 'getDefault'), 'getDefault');
		strictEqual(storageService.getNumber('test.getNumberDefault', scope, 5), 5);
		strictEqual(storageService.getBoolean('test.getBooleanDefault', scope, true), true);
		deepStrictEqual(storageService.getObject('test.getObjectDefault', scope, { 'foo': 42 }), { 'foo': 42 });

		storageService.storeAll([
			{ key: 'test.storeAll1', value: 'foobar', scope, target: StorageTarget.MACHINE },
			{ key: 'test.storeAll2', value: 4, scope, target: StorageTarget.MACHINE },
			{ key: 'test.storeAll3', value: null, scope, target: StorageTarget.MACHINE }
		], false);

		strictEqual(storageService.get('test.storeAll1', scope, 'foobar'), 'foobar');
		strictEqual(storageService.get('test.storeAll2', scope, '4'), '4');
		strictEqual(storageService.get('test.storeAll3', scope, 'null'), 'null');
	}

	test('Remove Data (application)', () => {
		removeData(StorageScope.APPLICATION);
	});

	test('Remove Data (profile)', () => {
		removeData(StorageScope.PROFILE);
	});

	test('Remove Data (workspace)', () => {
		removeData(StorageScope.WORKSPACE);
	});

	function removeData(scope: StorageScope): void {
		const storageValueChangeEvents: IStorageValueChangeEvent[] = [];
		storageService.onDidChangeValue(scope, undefined, new DisposableStore())(e => storageValueChangeEvents.push(e));

		storageService.store('test.remove', 'foobar', scope, StorageTarget.MACHINE);
		strictEqual('foobar', storageService.get('test.remove', scope, (undefined)!));

		storageService.remove('test.remove', scope);
		ok(!storageService.get('test.remove', scope, (undefined)!));
		const storageValueChangeEvent = storageValueChangeEvents.find(e => e.key === 'test.remove');
		strictEqual(storageValueChangeEvent?.scope, scope);
		strictEqual(storageValueChangeEvent?.key, 'test.remove');
	}

	test('Keys (in-memory)', () => {
		let storageTargetEvent: IStorageTargetChangeEvent | undefined = undefined;
		storageService.onDidChangeTarget(e => storageTargetEvent = e);

		// Empty
		for (const scope of [StorageScope.WORKSPACE, StorageScope.PROFILE, StorageScope.APPLICATION]) {
			for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
				strictEqual(storageService.keys(scope, target).length, 0);
			}
		}

		let storageValueChangeEvent: IStorageValueChangeEvent | undefined = undefined;

		// Add values
		for (const scope of [StorageScope.WORKSPACE, StorageScope.PROFILE, StorageScope.APPLICATION]) {
			storageService.onDidChangeValue(scope, undefined, new DisposableStore())(e => storageValueChangeEvent = e);

			for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
				storageTargetEvent = Object.create(null);
				storageValueChangeEvent = Object.create(null);

				storageService.store('test.target1', 'value1', scope, target);
				strictEqual(storageService.keys(scope, target).length, 1);
				strictEqual(storageTargetEvent?.scope, scope);
				strictEqual(storageValueChangeEvent?.key, 'test.target1');
				strictEqual(storageValueChangeEvent?.scope, scope);
				strictEqual(storageValueChangeEvent?.target, target);

				storageTargetEvent = undefined;
				storageValueChangeEvent = Object.create(null);

				storageService.store('test.target1', 'otherValue1', scope, target);
				strictEqual(storageService.keys(scope, target).length, 1);
				strictEqual(storageTargetEvent, undefined);
				strictEqual(storageValueChangeEvent?.key, 'test.target1');
				strictEqual(storageValueChangeEvent?.scope, scope);
				strictEqual(storageValueChangeEvent?.target, target);

				storageService.store('test.target2', 'value2', scope, target);
				storageService.store('test.target3', 'value3', scope, target);

				strictEqual(storageService.keys(scope, target).length, 3);
			}
		}

		// Remove values
		for (const scope of [StorageScope.WORKSPACE, StorageScope.PROFILE, StorageScope.APPLICATION]) {
			for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
				const keysLength = storageService.keys(scope, target).length;

				storageService.store('test.target4', 'value1', scope, target);
				strictEqual(storageService.keys(scope, target).length, keysLength + 1);

				storageTargetEvent = Object.create(null);
				storageValueChangeEvent = Object.create(null);

				storageService.remove('test.target4', scope);
				strictEqual(storageService.keys(scope, target).length, keysLength);
				strictEqual(storageTargetEvent?.scope, scope);
				strictEqual(storageValueChangeEvent?.key, 'test.target4');
				strictEqual(storageValueChangeEvent?.scope, scope);
			}
		}

		// Remove all
		for (const scope of [StorageScope.WORKSPACE, StorageScope.PROFILE, StorageScope.APPLICATION]) {
			for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
				const keys = storageService.keys(scope, target);

				for (const key of keys) {
					storageService.remove(key, scope);
				}

				strictEqual(storageService.keys(scope, target).length, 0);
			}
		}

		// Adding undefined or null removes value
		for (const scope of [StorageScope.WORKSPACE, StorageScope.PROFILE, StorageScope.APPLICATION]) {
			for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
				storageService.store('test.target1', 'value1', scope, target);
				strictEqual(storageService.keys(scope, target).length, 1);

				storageTargetEvent = Object.create(null);

				storageService.store('test.target1', undefined, scope, target);
				strictEqual(storageService.keys(scope, target).length, 0);
				strictEqual(storageTargetEvent?.scope, scope);

				storageService.store('test.target1', '', scope, target);
				strictEqual(storageService.keys(scope, target).length, 1);

				storageService.store('test.target1', null, scope, target);
				strictEqual(storageService.keys(scope, target).length, 0);
			}
		}

		// Target change
		for (const scope of [StorageScope.WORKSPACE, StorageScope.PROFILE, StorageScope.APPLICATION]) {
			storageTargetEvent = undefined;
			storageService.store('test.target5', 'value1', scope, StorageTarget.MACHINE);
			ok(storageTargetEvent);
			storageTargetEvent = undefined;
			storageService.store('test.target5', 'value1', scope, StorageTarget.USER);
			ok(storageTargetEvent);
			storageTargetEvent = undefined;
			storageService.store('test.target5', 'value1', scope, StorageTarget.MACHINE);
			ok(storageTargetEvent);
			storageTargetEvent = undefined;
			storageService.store('test.target5', 'value1', scope, StorageTarget.MACHINE);
			ok(!storageTargetEvent); // no change in target
		}
	});
}

suite('StorageService (in-memory)', function () {
	createSuite<InMemoryStorageService>({
		setup: async () => new InMemoryStorageService(),
		teardown: async () => { }
	});
});
