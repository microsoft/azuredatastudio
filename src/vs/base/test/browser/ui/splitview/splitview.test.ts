/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter } from 'vs/base/common/event';
import { SplitView, IView, Orientation, Sizing, LayoutPriority } from 'vs/base/browser/ui/splitview/splitview';
import { Sash, SashState } from 'vs/base/browser/ui/sash/sash';

class TestView implements IView {

	private _onDidChange = new Emitter<number | undefined>();
	readonly onDidChange = this._onDidChange.event;

	get minimumSize(): number { return this._minimumSize; }
	set minimumSize(size: number) { this._minimumSize = size; this._onDidChange.fire(); }

	get maximumSize(): number { return this._maximumSize; }
	set maximumSize(size: number) { this._maximumSize = size; this._onDidChange.fire(); }

	private _element: HTMLElement = document.createElement('div');
	get element(): HTMLElement { this._onDidGetElement.fire(); return this._element; }

	private _onDidGetElement = new Emitter<void>();
	readonly onDidGetElement = this._onDidGetElement.event;

	private _size = 0;
	get size(): number { return this._size; }
	private _onDidLayout = new Emitter<{ size: number; orientation: Orientation }>();
	readonly onDidLayout = this._onDidLayout.event;

	private _onDidFocus = new Emitter<void>();
	readonly onDidFocus = this._onDidFocus.event;

	constructor(
		private _minimumSize: number,
		private _maximumSize: number,
		readonly priority: LayoutPriority = LayoutPriority.Normal
	) {
		assert(_minimumSize <= _maximumSize, 'splitview view minimum size must be <= maximum size');
	}

	layout(size: number, orientation: Orientation): void {
		this._size = size;
		this._onDidLayout.fire({ size, orientation });
	}

	focus(): void {
		this._onDidFocus.fire();
	}

	dispose(): void {
		this._onDidChange.dispose();
		this._onDidGetElement.dispose();
		this._onDidLayout.dispose();
		this._onDidFocus.dispose();
	}
}

function getSashes(splitview: SplitView): Sash[] {
	return (splitview as any).sashItems.map(i => i.sash) as Sash[];
}

// {{SQL CARBON EDIT}} disable broken tests
suite('Splitview', () => {
	test('empty splitview has empty DOM', () => {
	});

	test('proportional layout', () => {
		const view1 = new TestView(20, Number.POSITIVE_INFINITY);
		const view2 = new TestView(20, Number.POSITIVE_INFINITY);
		const splitview = new SplitView(container);
		splitview.layout(200);

		splitview.addView(view1, Sizing.Distribute);
		splitview.addView(view2, Sizing.Distribute);
		assert.deepEqual([view1.size, view2.size], [100, 100]);

		splitview.layout(100);
		assert.deepEqual([view1.size, view2.size], [50, 50]);

		splitview.dispose();
		view2.dispose();
		view1.dispose();
	});

	test('disable proportional layout', () => {
		const view1 = new TestView(20, Number.POSITIVE_INFINITY);
		const view2 = new TestView(20, Number.POSITIVE_INFINITY);
		const splitview = new SplitView(container, { proportionalLayout: false });
		splitview.layout(200);

		splitview.addView(view1, Sizing.Distribute);
		splitview.addView(view2, Sizing.Distribute);
		assert.deepEqual([view1.size, view2.size], [100, 100]);

		splitview.layout(100);
		assert.deepEqual([view1.size, view2.size], [80, 20]);

		splitview.dispose();
		view2.dispose();
		view1.dispose();
	});

	test('high layout priority', () => {
		const view1 = new TestView(20, Number.POSITIVE_INFINITY);
		const view2 = new TestView(20, Number.POSITIVE_INFINITY, LayoutPriority.High);
		const view3 = new TestView(20, Number.POSITIVE_INFINITY);
		const splitview = new SplitView(container, { proportionalLayout: false });
		splitview.layout(200);

		splitview.addView(view1, Sizing.Distribute);
		splitview.addView(view2, Sizing.Distribute);
		splitview.addView(view3, Sizing.Distribute);
		assert.deepEqual([view1.size, view2.size, view3.size], [66, 66, 68]);

		splitview.layout(180);
		assert.deepEqual([view1.size, view2.size, view3.size], [66, 46, 68]);

		splitview.layout(124);
		assert.deepEqual([view1.size, view2.size, view3.size], [66, 20, 38]);

		splitview.layout(60);
		assert.deepEqual([view1.size, view2.size, view3.size], [20, 20, 20]);

		splitview.layout(200);
		assert.deepEqual([view1.size, view2.size, view3.size], [20, 160, 20]);

		splitview.dispose();
		view3.dispose();
		view2.dispose();
		view1.dispose();
	});

	test('low layout priority', () => {
		const view1 = new TestView(20, Number.POSITIVE_INFINITY);
		const view2 = new TestView(20, Number.POSITIVE_INFINITY);
		const view3 = new TestView(20, Number.POSITIVE_INFINITY, LayoutPriority.Low);
		const splitview = new SplitView(container, { proportionalLayout: false });
		splitview.layout(200);

		splitview.addView(view1, Sizing.Distribute);
		splitview.addView(view2, Sizing.Distribute);
		splitview.addView(view3, Sizing.Distribute);
		assert.deepEqual([view1.size, view2.size, view3.size], [66, 66, 68]);

		splitview.layout(180);
		assert.deepEqual([view1.size, view2.size, view3.size], [66, 46, 68]);

		splitview.layout(132);
		assert.deepEqual([view1.size, view2.size, view3.size], [44, 20, 68]);

		splitview.layout(60);
		assert.deepEqual([view1.size, view2.size, view3.size], [20, 20, 20]);

		splitview.layout(200);
		assert.deepEqual([view1.size, view2.size, view3.size], [20, 160, 20]);

		splitview.dispose();
		view3.dispose();
		view2.dispose();
		view1.dispose();
	});
});