/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ArrayNavigator } from 'vs/base/common/navigator';
import { HeightMap, IViewItem } from 'vs/base/parts/tree/browser/treeViewModel';

function makeItem(id: any, height: any): any {
	return {
		id: id,
		getHeight: function () { return height; },
		isExpanded: function () { return false; },
		getAllTraits: () => []
	};
}

function makeItems(...args: any[]) {
	let r: any[] = [];

	for (let i = 0; i < args.length; i += 2) {
		r.push(makeItem(args[i], args[i + 1]));
	}

	return r;
}

function makeNavigator(...args: any[]): any {
	let items = makeItems.apply(null, args);
	let i = 0;

	return {
		next: function () {
			return items[i++] || null;
		}
	};
}

class TestHeightMap extends HeightMap {

	protected override createViewItem(item: any): IViewItem {
		return {
			model: item,
			top: 0,
			height: item.getHeight(),
			width: 0
		};
	}
}

suite('TreeView - HeightMap', () => {
	let rangeMap: HeightMap;

	setup(() => {
		rangeMap = new TestHeightMap();
		rangeMap.onInsertItems(makeNavigator('a', 3, 'b', 30, 'c', 25, 'd', 2));
	});

	teardown(() => {
		rangeMap.dispose();
		rangeMap = null!;
	});

	test('simple', () => {
		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'b');
		assert.strictEqual(rangeMap.itemAt(32), 'b');
		assert.strictEqual(rangeMap.itemAt(33), 'c');
		assert.strictEqual(rangeMap.itemAt(40), 'c');
		assert.strictEqual(rangeMap.itemAt(57), 'c');
		assert.strictEqual(rangeMap.itemAt(58), 'd');
		assert.strictEqual(rangeMap.itemAt(59), 'd');
		assert.throws(() => rangeMap.itemAt(60));
	});

	test('onInsertItems at beginning', () => {
		let navigator = makeNavigator('x', 4, 'y', 20, 'z', 8);
		rangeMap.onInsertItems(navigator);

		assert.strictEqual(rangeMap.itemAt(0), 'x');
		assert.strictEqual(rangeMap.itemAt(3), 'x');
		assert.strictEqual(rangeMap.itemAt(4), 'y');
		assert.strictEqual(rangeMap.itemAt(23), 'y');
		assert.strictEqual(rangeMap.itemAt(24), 'z');
		assert.strictEqual(rangeMap.itemAt(31), 'z');
		assert.strictEqual(rangeMap.itemAt(32), 'a');
		assert.strictEqual(rangeMap.itemAt(34), 'a');
		assert.strictEqual(rangeMap.itemAt(35), 'b');
		assert.strictEqual(rangeMap.itemAt(64), 'b');
		assert.strictEqual(rangeMap.itemAt(65), 'c');
		assert.strictEqual(rangeMap.itemAt(89), 'c');
		assert.strictEqual(rangeMap.itemAt(90), 'd');
		assert.strictEqual(rangeMap.itemAt(91), 'd');
		assert.throws(() => rangeMap.itemAt(92));
	});

	test('onInsertItems in middle', () => {
		let navigator = makeNavigator('x', 4, 'y', 20, 'z', 8);
		rangeMap.onInsertItems(navigator, 'a');

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'x');
		assert.strictEqual(rangeMap.itemAt(6), 'x');
		assert.strictEqual(rangeMap.itemAt(7), 'y');
		assert.strictEqual(rangeMap.itemAt(26), 'y');
		assert.strictEqual(rangeMap.itemAt(27), 'z');
		assert.strictEqual(rangeMap.itemAt(34), 'z');
		assert.strictEqual(rangeMap.itemAt(35), 'b');
		assert.strictEqual(rangeMap.itemAt(64), 'b');
		assert.strictEqual(rangeMap.itemAt(65), 'c');
		assert.strictEqual(rangeMap.itemAt(89), 'c');
		assert.strictEqual(rangeMap.itemAt(90), 'd');
		assert.strictEqual(rangeMap.itemAt(91), 'd');
		assert.throws(() => rangeMap.itemAt(92));
	});

	test('onInsertItems at end', () => {
		let navigator = makeNavigator('x', 4, 'y', 20, 'z', 8);
		rangeMap.onInsertItems(navigator, 'd');

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'b');
		assert.strictEqual(rangeMap.itemAt(32), 'b');
		assert.strictEqual(rangeMap.itemAt(33), 'c');
		assert.strictEqual(rangeMap.itemAt(57), 'c');
		assert.strictEqual(rangeMap.itemAt(58), 'd');
		assert.strictEqual(rangeMap.itemAt(59), 'd');
		assert.strictEqual(rangeMap.itemAt(60), 'x');
		assert.strictEqual(rangeMap.itemAt(63), 'x');
		assert.strictEqual(rangeMap.itemAt(64), 'y');
		assert.strictEqual(rangeMap.itemAt(83), 'y');
		assert.strictEqual(rangeMap.itemAt(84), 'z');
		assert.strictEqual(rangeMap.itemAt(91), 'z');
		assert.throws(() => rangeMap.itemAt(92));
	});

	test('onRemoveItems at beginning', () => {
		rangeMap.onRemoveItems(new ArrayNavigator(['a', 'b']));

		assert.strictEqual(rangeMap.itemAt(0), 'c');
		assert.strictEqual(rangeMap.itemAt(24), 'c');
		assert.strictEqual(rangeMap.itemAt(25), 'd');
		assert.strictEqual(rangeMap.itemAt(26), 'd');
		assert.throws(() => rangeMap.itemAt(27));
	});

	test('onRemoveItems in middle', () => {
		rangeMap.onRemoveItems(new ArrayNavigator(['c']));

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'b');
		assert.strictEqual(rangeMap.itemAt(32), 'b');
		assert.strictEqual(rangeMap.itemAt(33), 'd');
		assert.strictEqual(rangeMap.itemAt(34), 'd');
		assert.throws(() => rangeMap.itemAt(35));
	});

	test('onRemoveItems at end', () => {
		rangeMap.onRemoveItems(new ArrayNavigator(['c', 'd']));

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'b');
		assert.strictEqual(rangeMap.itemAt(32), 'b');
		assert.throws(() => rangeMap.itemAt(33));
	});

	test('onRefreshItems at beginning', () => {
		let navigator = makeNavigator('a', 1, 'b', 1);
		rangeMap.onRefreshItems(navigator);

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(1), 'b');
		assert.strictEqual(rangeMap.itemAt(2), 'c');
		assert.strictEqual(rangeMap.itemAt(26), 'c');
		assert.strictEqual(rangeMap.itemAt(27), 'd');
		assert.strictEqual(rangeMap.itemAt(28), 'd');
		assert.throws(() => rangeMap.itemAt(29));
	});

	test('onRefreshItems in middle', () => {
		let navigator = makeNavigator('b', 40, 'c', 4);
		rangeMap.onRefreshItems(navigator);

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'b');
		assert.strictEqual(rangeMap.itemAt(42), 'b');
		assert.strictEqual(rangeMap.itemAt(43), 'c');
		assert.strictEqual(rangeMap.itemAt(46), 'c');
		assert.strictEqual(rangeMap.itemAt(47), 'd');
		assert.strictEqual(rangeMap.itemAt(48), 'd');
		assert.throws(() => rangeMap.itemAt(49));
	});

	test('onRefreshItems at end', () => {
		let navigator = makeNavigator('d', 22);
		rangeMap.onRefreshItems(navigator);

		assert.strictEqual(rangeMap.itemAt(0), 'a');
		assert.strictEqual(rangeMap.itemAt(2), 'a');
		assert.strictEqual(rangeMap.itemAt(3), 'b');
		assert.strictEqual(rangeMap.itemAt(32), 'b');
		assert.strictEqual(rangeMap.itemAt(33), 'c');
		assert.strictEqual(rangeMap.itemAt(57), 'c');
		assert.strictEqual(rangeMap.itemAt(58), 'd');
		assert.strictEqual(rangeMap.itemAt(79), 'd');
		assert.throws(() => rangeMap.itemAt(80));
	});

	test('withItemsInRange', () => {
		let i = 0;
		let itemsInRange = ['a', 'b'];
		rangeMap.withItemsInRange(2, 27, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);

		i = 0;
		itemsInRange = ['a', 'b'];
		rangeMap.withItemsInRange(0, 3, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);

		i = 0;
		itemsInRange = ['a'];
		rangeMap.withItemsInRange(0, 2, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);

		i = 0;
		itemsInRange = ['a'];
		rangeMap.withItemsInRange(0, 2, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);

		i = 0;
		itemsInRange = ['b', 'c'];
		rangeMap.withItemsInRange(15, 39, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);

		i = 0;
		itemsInRange = ['a', 'b', 'c', 'd'];
		rangeMap.withItemsInRange(1, 58, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);

		i = 0;
		itemsInRange = ['c', 'd'];
		rangeMap.withItemsInRange(45, 58, function (item) { assert.strictEqual(item, itemsInRange[i++]); });
		assert.strictEqual(i, itemsInRange.length);
	});
});
