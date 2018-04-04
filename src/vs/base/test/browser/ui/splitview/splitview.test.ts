/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter } from 'vs/base/common/event';
import { SplitView, IView, Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { Sash } from 'vs/base/browser/ui/sash/sash';

class TestView implements IView {

	private _onDidChange = new Emitter<number | undefined>();
	readonly onDidChange = this._onDidChange.event;

	get minimumSize(): number { return this._minimumSize; }
	set minimumSize(size: number) { this._minimumSize = size; this._onDidChange.fire(); }

	get maximumSize(): number { return this._maximumSize; }
	set maximumSize(size: number) { this._maximumSize = size; this._onDidChange.fire(); }

	private _onDidRender = new Emitter<{ container: HTMLElement; orientation: Orientation }>();
	readonly onDidRender = this._onDidRender.event;

	private _size = 0;
	get size(): number { return this._size; }
	private _onDidLayout = new Emitter<{ size: number; orientation: Orientation }>();
	readonly onDidLayout = this._onDidLayout.event;

	private _onDidFocus = new Emitter<void>();
	readonly onDidFocus = this._onDidFocus.event;

	constructor(
		private _minimumSize: number,
		private _maximumSize: number
	) {
		assert(_minimumSize <= _maximumSize, 'splitview view minimum size must be <= maximum size');
	}

	render(container: HTMLElement, orientation: Orientation): void {
		this._onDidRender.fire({ container, orientation });
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
		this._onDidRender.dispose();
		this._onDidLayout.dispose();
		this._onDidFocus.dispose();
	}
}

function getSashes(splitview: SplitView): Sash[] {
	return (splitview as any).sashItems.map(i => i.sash) as Sash[];
}

suite('Splitview', () => {
	test('empty splitview has empty DOM', () => {
	});
});