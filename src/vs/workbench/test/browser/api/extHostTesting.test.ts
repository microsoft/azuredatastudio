/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { VSBuffer } from 'vs/base/common/buffer';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Iterable } from 'vs/base/common/iterator';
import { mockObject, MockObject } from 'vs/base/test/common/mock';
import { MainThreadTestingShape } from 'vs/workbench/api/common/extHost.protocol';
import { TestRunCoordinator, TestRunDto, TestRunProfileImpl } from 'vs/workbench/api/common/extHostTesting';
import * as convert from 'vs/workbench/api/common/extHostTypeConverters';
import { TestMessage, TestResultState, TestRunProfileKind, TestTag } from 'vs/workbench/api/common/extHostTypes';
import { TestDiffOpType, TestItemExpandState } from 'vs/workbench/contrib/testing/common/testCollection';
import { TestId } from 'vs/workbench/contrib/testing/common/testId';
import { TestItemImpl, testStubs } from 'vs/workbench/contrib/testing/common/testStubs';
import { TestSingleUseCollection } from 'vs/workbench/contrib/testing/test/common/ownedTestCollection';
import type { TestItem, TestRunRequest } from 'vscode';

const simplify = (item: TestItem) => ({
	id: item.id,
	label: item.label,
	uri: item.uri,
	range: item.range,
});

const assertTreesEqual = (a: TestItemImpl | undefined, b: TestItemImpl | undefined) => {
	if (!a) {
		throw new assert.AssertionError({ message: 'Expected a to be defined', actual: a });
	}

	if (!b) {
		throw new assert.AssertionError({ message: 'Expected b to be defined', actual: b });
	}

	assert.deepStrictEqual(simplify(a), simplify(b));

	const aChildren = [...a.children].map(c => c.id).sort();
	const bChildren = [...b.children].map(c => c.id).sort();
	assert.strictEqual(aChildren.length, bChildren.length, `expected ${a.label}.children.length == ${b.label}.children.length`);
	aChildren.forEach(key => assertTreesEqual(a.children.get(key) as TestItemImpl, b.children.get(key) as TestItemImpl));
};

// const assertTreeListEqual = (a: ReadonlyArray<TestItem>, b: ReadonlyArray<TestItem>) => {
// 	assert.strictEqual(a.length, b.length, `expected a.length == n.length`);
// 	a.forEach((_, i) => assertTreesEqual(a[i], b[i]));
// };

// class TestMirroredCollection extends MirroredTestCollection {
// 	public changeEvent!: TestChangeEvent;

// 	constructor() {
// 		super();
// 		this.onDidChangeTests(evt => this.changeEvent = evt);
// 	}

// 	public get length() {
// 		return this.items.size;
// 	}
// }

suite('ExtHost Testing', () => {
	let single: TestSingleUseCollection;
	setup(() => {
		single = testStubs.nested();
		single.onDidGenerateDiff(d => single.setDiff(d /* don't clear during testing */));
	});

	teardown(() => {
		single.dispose();
	});

	suite('OwnedTestCollection', () => {
		test('adds a root recursively', async () => {
			await single.expand(single.root.id, Infinity);
			const a = single.root.children.get('id-a') as TestItemImpl;
			const b = single.root.children.get('id-b') as TestItemImpl;
			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Add,
					{ controllerId: 'ctrlId', parent: null, expand: TestItemExpandState.BusyExpanding, item: { ...convert.TestItem.from(single.root) } }
				],
				[
					TestDiffOpType.Add,
					{ controllerId: 'ctrlId', parent: single.root.id, expand: TestItemExpandState.BusyExpanding, item: { ...convert.TestItem.from(a) } }
				],
				[
					TestDiffOpType.Add,
					{ controllerId: 'ctrlId', parent: new TestId(['ctrlId', 'id-a']).toString(), expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(a.children.get('id-aa') as TestItemImpl) }
				],
				[
					TestDiffOpType.Add,
					{ controllerId: 'ctrlId', parent: new TestId(['ctrlId', 'id-a']).toString(), expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(a.children.get('id-ab') as TestItemImpl) }
				],
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a']).toString(), expand: TestItemExpandState.Expanded }
				],
				[
					TestDiffOpType.Add,
					{ controllerId: 'ctrlId', parent: single.root.id, expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(b) }
				],
				[
					TestDiffOpType.Update,
					{ extId: single.root.id, expand: TestItemExpandState.Expanded }
				],
			]);
		});

		test('parents are set correctly', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();

			const a = single.root.children.get('id-a')!;
			const ab = a.children.get('id-ab')!;
			assert.strictEqual(a.parent, undefined);
			assert.strictEqual(ab.parent, a);
		});

		test('no-ops if items not changed', () => {
			single.collectDiff();
			assert.deepStrictEqual(single.collectDiff(), []);
		});

		test('watches property mutations', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();
			single.root.children.get('id-a')!.description = 'Hello world'; /* item a */

			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a']).toString(), item: { description: 'Hello world' } }],
			]);
		});

		test('removes children', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();
			single.root.children.delete('id-a');

			assert.deepStrictEqual(single.collectDiff(), [
				[TestDiffOpType.Remove, new TestId(['ctrlId', 'id-a']).toString()],
			]);
			assert.deepStrictEqual(
				[...single.tree.keys()].sort(),
				[single.root.id, new TestId(['ctrlId', 'id-b']).toString()],
			);
			assert.strictEqual(single.tree.size, 2);
		});

		test('adds new children', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();
			const child = new TestItemImpl('ctrlId', 'id-ac', 'c', undefined);
			single.root.children.get('id-a')!.children.add(child);

			assert.deepStrictEqual(single.collectDiff(), [
				[TestDiffOpType.Add, {
					controllerId: 'ctrlId',
					parent: new TestId(['ctrlId', 'id-a']).toString(),
					expand: TestItemExpandState.NotExpandable,
					item: convert.TestItem.from(child),
				}],
			]);
			assert.deepStrictEqual(
				[...single.tree.values()].map(n => n.actual.id).sort(),
				[single.root.id, 'id-a', 'id-aa', 'id-ab', 'id-ac', 'id-b'],
			);
			assert.strictEqual(single.tree.size, 6);
		});

		test('manages tags correctly', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();
			const tag1 = new TestTag('tag1', 'Tag 1');
			const tag2 = new TestTag('tag2', 'Tag 2');
			const tag3 = new TestTag('tag3');
			const child = new TestItemImpl('ctrlId', 'id-ac', 'c', undefined);
			child.tags = [tag1, tag2];
			single.root.children.get('id-a')!.children.add(child);

			assert.deepStrictEqual(single.collectDiff(), [
				[TestDiffOpType.AddTag, { ctrlLabel: 'root', id: 'ctrlId\0tag1', label: 'Tag 1' }],
				[TestDiffOpType.AddTag, { ctrlLabel: 'root', id: 'ctrlId\0tag2', label: 'Tag 2' }],
				[TestDiffOpType.Add, {
					controllerId: 'ctrlId',
					parent: new TestId(['ctrlId', 'id-a']).toString(),
					expand: TestItemExpandState.NotExpandable,
					item: convert.TestItem.from(child),
				}],
			]);

			child.tags = [tag2, tag3];
			assert.deepStrictEqual(single.collectDiff(), [
				[TestDiffOpType.AddTag, { ctrlLabel: 'root', id: 'ctrlId\0tag3', label: undefined }],
				[TestDiffOpType.Update, {
					extId: new TestId(['ctrlId', 'id-a', 'id-ac']).toString(),
					item: { tags: ['ctrlId\0tag2', 'ctrlId\0tag3'] }
				}],
				[TestDiffOpType.RemoveTag, 'ctrlId\0tag1'],
			]);

			const a = single.root.children.get('id-a')!;
			a.tags = [tag2];
			a.children.replace([]);
			assert.deepStrictEqual(single.collectDiff().filter(t => t[0] === TestDiffOpType.RemoveTag), [
				[TestDiffOpType.RemoveTag, 'ctrlId\0tag3'],
			]);
		});

		test('treats in-place replacement as mutation', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();

			const oldA = single.root.children.get('id-a') as TestItemImpl;
			const newA = new TestItemImpl('ctrlId', 'id-a', 'Hello world', undefined);
			newA.children.replace([...oldA.children]);
			single.root.children.replace([
				newA,
				new TestItemImpl('ctrlId', 'id-b', single.root.children.get('id-b')!.label, undefined),
			]);

			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a']).toString(), expand: TestItemExpandState.Expanded, item: { label: 'Hello world' } },
				],
			]);

			newA.label = 'still connected';
			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a']).toString(), item: { label: 'still connected' } }
				],
			]);

			oldA.label = 'no longer connected';
			assert.deepStrictEqual(single.collectDiff(), []);
		});

		test('treats in-place replacement as mutation deeply', () => {
			single.expand(single.root.id, Infinity);
			single.collectDiff();

			const oldA = single.root.children.get('id-a')!;
			const newA = new TestItemImpl('ctrlId', 'id-a', single.root.children.get('id-a')!.label, undefined);
			const oldAA = oldA.children.get('id-aa')!;
			const oldAB = oldA.children.get('id-ab')!;
			const newAB = new TestItemImpl('ctrlId', 'id-ab', 'Hello world', undefined);
			newA.children.replace([oldAA, newAB]);
			single.root.children.replace([newA, single.root.children.get('id-b')!]);

			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a']).toString(), expand: TestItemExpandState.Expanded },
				],
				[
					TestDiffOpType.Update,
					{ extId: TestId.fromExtHostTestItem(oldAB, 'ctrlId').toString(), item: { label: 'Hello world' } },
				],
			]);

			oldAA.label = 'still connected1';
			newAB.label = 'still connected2';
			oldAB.label = 'not connected3';
			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a', 'id-aa']).toString(), item: { label: 'still connected1' } }
				],
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a', 'id-ab']).toString(), item: { label: 'still connected2' } }
				],
			]);

			assert.strictEqual(newAB.parent, newA);
			assert.strictEqual(oldAA.parent, newA);
			assert.deepStrictEqual(newA.parent, undefined);
		});

		test('moves an item to be a new child', async () => {
			await single.expand(single.root.id, 0);
			single.collectDiff();
			const b = single.root.children.get('id-b') as TestItemImpl;
			const a = single.root.children.get('id-a') as TestItemImpl;
			a.children.add(b);
			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Remove,
					new TestId(['ctrlId', 'id-b']).toString(),
				],
				[
					TestDiffOpType.Add,
					{ controllerId: 'ctrlId', parent: new TestId(['ctrlId', 'id-a']).toString(), expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(b) }
				],
			]);

			b.label = 'still connected';
			assert.deepStrictEqual(single.collectDiff(), [
				[
					TestDiffOpType.Update,
					{ extId: new TestId(['ctrlId', 'id-a', 'id-b']).toString(), item: { label: 'still connected' } }
				],
			]);

			assert.deepStrictEqual([...single.root.children], [single.root.children.get('id-a')]);
			assert.deepStrictEqual(b.parent, a);
		});
	});


	suite('MirroredTestCollection', () => {
		// todo@connor4312: re-renable when we figure out what observing looks like we async children
		// 	let m: TestMirroredCollection;
		// 	setup(() => m = new TestMirroredCollection());

		// 	test('mirrors creation of the root', () => {
		// 		const tests = testStubs.nested();
		// 		single.addRoot(tests, 'pid');
		// 		single.expand(single.root.id, Infinity);
		// 		m.apply(single.collectDiff());
		// 		assertTreesEqual(m.rootTestItems[0], owned.getTestById(single.root.id)![1].actual);
		// 		assert.strictEqual(m.length, single.itemToInternal.size);
		// 	});

		// 	test('mirrors node deletion', () => {
		// 		const tests = testStubs.nested();
		// 		single.addRoot(tests, 'pid');
		// 		m.apply(single.collectDiff());
		// 		single.expand(single.root.id, Infinity);
		// 		tests.children!.splice(0, 1);
		// 		single.onItemChange(tests, 'pid');
		// 		single.expand(single.root.id, Infinity);
		// 		m.apply(single.collectDiff());

		// 		assertTreesEqual(m.rootTestItems[0], owned.getTestById(single.root.id)![1].actual);
		// 		assert.strictEqual(m.length, single.itemToInternal.size);
		// 	});

		// 	test('mirrors node addition', () => {
		// 		const tests = testStubs.nested();
		// 		single.addRoot(tests, 'pid');
		// 		m.apply(single.collectDiff());
		// 		tests.children![0].children!.push(stubTest('ac'));
		// 		single.onItemChange(tests, 'pid');
		// 		m.apply(single.collectDiff());

		// 		assertTreesEqual(m.rootTestItems[0], owned.getTestById(single.root.id)![1].actual);
		// 		assert.strictEqual(m.length, single.itemToInternal.size);
		// 	});

		// 	test('mirrors node update', () => {
		// 		const tests = testStubs.nested();
		// 		single.addRoot(tests, 'pid');
		// 		m.apply(single.collectDiff());
		// 		tests.children![0].description = 'Hello world'; /* item a */
		// 		single.onItemChange(tests, 'pid');
		// 		m.apply(single.collectDiff());

		// 		assertTreesEqual(m.rootTestItems[0], owned.getTestById(single.root.id)![1].actual);
		// 	});

		// 	suite('MirroredChangeCollector', () => {
		// 		let tests = testStubs.nested();
		// 		setup(() => {
		// 			tests = testStubs.nested();
		// 			single.addRoot(tests, 'pid');
		// 			m.apply(single.collectDiff());
		// 		});

		// 		test('creates change for root', () => {
		// 			assertTreeListEqual(m.changeEvent.added, [
		// 				tests,
		// 				tests.children[0],
		// 				tests.children![0].children![0],
		// 				tests.children![0].children![1],
		// 				tests.children[1],
		// 			]);
		// 			assertTreeListEqual(m.changeEvent.removed, []);
		// 			assertTreeListEqual(m.changeEvent.updated, []);
		// 		});

		// 		test('creates change for delete', () => {
		// 			const rm = tests.children.shift()!;
		// 			single.onItemChange(tests, 'pid');
		// 			m.apply(single.collectDiff());

		// 			assertTreeListEqual(m.changeEvent.added, []);
		// 			assertTreeListEqual(m.changeEvent.removed, [
		// 				{ ...rm },
		// 				{ ...rm.children![0] },
		// 				{ ...rm.children![1] },
		// 			]);
		// 			assertTreeListEqual(m.changeEvent.updated, []);
		// 		});

		// 		test('creates change for update', () => {
		// 			tests.children[0].label = 'updated!';
		// 			single.onItemChange(tests, 'pid');
		// 			m.apply(single.collectDiff());

		// 			assertTreeListEqual(m.changeEvent.added, []);
		// 			assertTreeListEqual(m.changeEvent.removed, []);
		// 			assertTreeListEqual(m.changeEvent.updated, [tests.children[0]]);
		// 		});

		// 		test('is a no-op if a node is added and removed', () => {
		// 			const nested = testStubs.nested('id2-');
		// 			tests.children.push(nested);
		// 			single.onItemChange(tests, 'pid');
		// 			tests.children.pop();
		// 			single.onItemChange(tests, 'pid');
		// 			const previousEvent = m.changeEvent;
		// 			m.apply(single.collectDiff());
		// 			assert.strictEqual(m.changeEvent, previousEvent);
		// 		});

		// 		test('is a single-op if a node is added and changed', () => {
		// 			const child = stubTest('c');
		// 			tests.children.push(child);
		// 			single.onItemChange(tests, 'pid');
		// 			child.label = 'd';
		// 			single.onItemChange(tests, 'pid');
		// 			m.apply(single.collectDiff());

		// 			assertTreeListEqual(m.changeEvent.added, [child]);
		// 			assertTreeListEqual(m.changeEvent.removed, []);
		// 			assertTreeListEqual(m.changeEvent.updated, []);
		// 		});

		// 		test('gets the common ancestor (1)', () => {
		// 			tests.children![0].children![0].label = 'za';
		// 			tests.children![0].children![1].label = 'zb';
		// 			single.onItemChange(tests, 'pid');
		// 			m.apply(single.collectDiff());

		// 		});

		// 		test('gets the common ancestor (2)', () => {
		// 			tests.children![0].children![0].label = 'za';
		// 			tests.children![1].label = 'ab';
		// 			single.onItemChange(tests, 'pid');
		// 			m.apply(single.collectDiff());
		// 		});
		// 	});
	});

	suite('TestRunTracker', () => {
		let proxy: MockObject<MainThreadTestingShape>;
		let c: TestRunCoordinator;
		let cts: CancellationTokenSource;
		let configuration: TestRunProfileImpl;

		let req: TestRunRequest;

		let dto: TestRunDto;

		setup(async () => {
			proxy = mockObject();
			cts = new CancellationTokenSource();
			c = new TestRunCoordinator(proxy);

			configuration = new TestRunProfileImpl(mockObject<MainThreadTestingShape, {}>(), 'ctrlId', 42, 'Do Run', TestRunProfileKind.Run, () => { }, false);

			await single.expand(single.root.id, Infinity);
			single.collectDiff();

			req = {
				include: undefined,
				exclude: [single.root.children.get('id-b')!],
				profile: configuration,
			};

			dto = TestRunDto.fromInternal({
				controllerId: 'ctrl',
				profileId: configuration.profileId,
				excludeExtIds: ['id-b'],
				runId: 'run-id',
				testIds: [single.root.id],
			}, single);
		});

		test('tracks a run started from a main thread request', () => {
			const tracker = c.prepareForMainThreadTestRun(req, dto, cts.token);
			assert.strictEqual(tracker.isRunning, false);

			const task1 = c.createTestRun('ctrl', single, req, 'run1', true);
			const task2 = c.createTestRun('ctrl', single, req, 'run2', true);
			assert.strictEqual(proxy.$startedExtensionTestRun.called, false);
			assert.strictEqual(tracker.isRunning, true);

			task1.appendOutput('hello');
			const taskId = proxy.$appendOutputToRun.args[0]?.[1];
			assert.deepStrictEqual([['run-id', taskId, VSBuffer.fromString('hello'), undefined, undefined]], proxy.$appendOutputToRun.args);
			task1.end();

			assert.strictEqual(proxy.$finishedExtensionTestRun.called, false);
			assert.strictEqual(tracker.isRunning, true);

			task2.end();

			assert.strictEqual(proxy.$finishedExtensionTestRun.called, false);
			assert.strictEqual(tracker.isRunning, false);
		});

		test('tracks a run started from an extension request', () => {
			const task1 = c.createTestRun('ctrl', single, req, 'hello world', false);

			const tracker = Iterable.first(c.trackers)!;
			assert.strictEqual(tracker.isRunning, true);
			assert.deepStrictEqual(proxy.$startedExtensionTestRun.args, [
				[{
					profile: { group: 2, id: 42 },
					controllerId: 'ctrl',
					id: tracker.id,
					include: [single.root.id],
					exclude: ['id-b'],
					persist: false,
				}]
			]);

			const task2 = c.createTestRun('ctrl', single, req, 'run2', true);
			const task3Detached = c.createTestRun('ctrl', single, { ...req }, 'task3Detached', true);

			task1.end();
			assert.strictEqual(proxy.$finishedExtensionTestRun.called, false);
			assert.strictEqual(tracker.isRunning, true);

			task2.end();
			assert.deepStrictEqual(proxy.$finishedExtensionTestRun.args, [[tracker.id]]);
			assert.strictEqual(tracker.isRunning, false);

			task3Detached.end();
		});

		test('adds tests to run smartly', () => {
			const task1 = c.createTestRun('ctrl', single, req, 'hello world', false);
			const tracker = Iterable.first(c.trackers)!;
			const expectedArgs: unknown[][] = [];
			assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);

			task1.passed(single.root.children.get('id-a')!.children.get('id-aa')!);
			expectedArgs.push([
				'ctrl',
				tracker.id,
				[
					convert.TestItem.from(single.root),
					convert.TestItem.from(single.root.children.get('id-a') as TestItemImpl),
					convert.TestItem.from(single.root.children.get('id-a')!.children.get('id-aa') as TestItemImpl),
				]
			]);
			assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);


			task1.enqueued(single.root.children.get('id-a')!.children.get('id-ab')!);
			expectedArgs.push([
				'ctrl',
				tracker.id,
				[
					convert.TestItem.from(single.root.children.get('id-a') as TestItemImpl),
					convert.TestItem.from(single.root.children.get('id-a')!.children.get('id-ab') as TestItemImpl),
				],
			]);
			assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);

			task1.passed(single.root.children.get('id-a')!.children.get('id-ab')!);
			assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);
		});

		test('guards calls after runs are ended', () => {
			const task = c.createTestRun('ctrl', single, req, 'hello world', false);
			task.end();

			task.failed(single.root, new TestMessage('some message'));
			task.appendOutput('output');

			assert.strictEqual(proxy.$addTestsToRun.called, false);
			assert.strictEqual(proxy.$appendOutputToRun.called, false);
			assert.strictEqual(proxy.$appendTestMessagesInRun.called, false);
		});

		test('excludes tests outside tree or explicitly excluded', () => {
			const task = c.createTestRun('ctrlId', single, {
				profile: configuration,
				include: [single.root.children.get('id-a')!],
				exclude: [single.root.children.get('id-a')!.children.get('id-aa')!],
			}, 'hello world', false);

			task.passed(single.root.children.get('id-a')!.children.get('id-aa')!);
			task.passed(single.root.children.get('id-a')!.children.get('id-ab')!);

			assert.deepStrictEqual(proxy.$updateTestStateInRun.args.length, 1);
			const args = proxy.$updateTestStateInRun.args[0];
			assert.deepStrictEqual(proxy.$updateTestStateInRun.args, [[
				args[0],
				args[1],
				new TestId(['ctrlId', 'id-a', 'id-ab']).toString(),
				TestResultState.Passed,
				undefined,
			]]);
		});
	});
});
