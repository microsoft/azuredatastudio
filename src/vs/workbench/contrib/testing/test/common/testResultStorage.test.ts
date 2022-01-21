/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { range } from 'vs/base/common/arrays';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestId } from 'vs/workbench/contrib/testing/common/testId';
import { ITestResult, LiveTestResult } from 'vs/workbench/contrib/testing/common/testResult';
import { InMemoryResultStorage, RETAIN_MAX_RESULTS } from 'vs/workbench/contrib/testing/common/testResultStorage';
import { Convert, TestItemImpl, testStubs } from 'vs/workbench/contrib/testing/common/testStubs';
import { emptyOutputController } from 'vs/workbench/contrib/testing/test/common/testResultService.test';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';

suite('Workbench - Test Result Storage', () => {
	let storage: InMemoryResultStorage;

	const makeResult = (addMessage?: string) => {
		const t = new LiveTestResult(
			'',
			emptyOutputController(),
			true,
			{ targets: [] }
		);

		t.addTask({ id: 't', name: undefined, running: true });
		const tests = testStubs.nested();
		tests.expand(tests.root.id, Infinity);
		t.addTestChainToRun('ctrlId', [
			Convert.TestItem.from(tests.root),
			Convert.TestItem.from(tests.root.children.get('id-a') as TestItemImpl),
			Convert.TestItem.from(tests.root.children.get('id-a')!.children.get('id-aa') as TestItemImpl),
		]);

		if (addMessage) {
			t.appendMessage(new TestId(['ctrlId', 'id-a']).toString(), 't', {
				message: addMessage,
				actual: undefined,
				expected: undefined,
				location: undefined,
				type: 0,
			});
		}
		t.markComplete();
		return t;
	};

	const assertStored = async (stored: ITestResult[]) =>
		assert.deepStrictEqual((await storage.read()).map(r => r.id), stored.map(s => s.id));

	setup(async () => {
		storage = new InMemoryResultStorage(new TestStorageService(), new NullLogService());
	});

	test('stores a single result', async () => {
		const r = range(5).map(() => makeResult());
		await storage.persist(r);
		await assertStored(r);
	});

	test('deletes old results', async () => {
		const r = range(5).map(() => makeResult());
		await storage.persist(r);
		const r2 = [makeResult(), ...r.slice(0, 3)];
		await storage.persist(r2);
		await assertStored(r2);
	});

	test('limits stored results', async () => {
		const r = range(100).map(() => makeResult());
		await storage.persist(r);
		await assertStored(r.slice(0, RETAIN_MAX_RESULTS));
	});

	test('limits stored result by budget', async () => {
		const r = range(100).map(() => makeResult('a'.repeat(2048)));
		await storage.persist(r);
		const length = (await storage.read()).length;
		assert.strictEqual(true, length < 50);
	});

	test('always stores the min number of results', async () => {
		const r = range(20).map(() => makeResult('a'.repeat(1024 * 10)));
		await storage.persist(r);
		await assertStored(r.slice(0, 16));
	});

	test('takes into account existing stored bytes', async () => {
		const r = range(10).map(() => makeResult('a'.repeat(1024 * 10)));
		await storage.persist(r);
		await assertStored(r);

		const r2 = [...r, ...range(10).map(() => makeResult('a'.repeat(1024 * 10)))];
		await storage.persist(r2);
		await assertStored(r2.slice(0, 16));
	});
});
