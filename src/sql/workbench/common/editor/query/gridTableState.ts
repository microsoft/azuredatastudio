/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { dispose, Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { isUndefined } from 'vs/base/common/types';

export class GridPanelState {
	public tableStates: GridTableState[] = [];
	public scrollPosition?: number;

	dispose() {
		dispose(this.tableStates);
	}
}

export class GridTableState extends Disposable {

	private _maximized?: boolean;

	private _onMaximizedChange = this._register(new Emitter<boolean>());
	public onMaximizedChange: Event<boolean> = this._onMaximizedChange.event;

	private _onCanBeMaximizedChange = this._register(new Emitter<boolean>());
	public onCanBeMaximizedChange: Event<boolean> = this._onCanBeMaximizedChange.event;

	private _canBeMaximized?: boolean;

	/* The top row of the current scroll */
	public scrollPositionY = 0;
	public scrollPositionX = 0;
	public columnSizes?: number[];
	public selection?: Slick.Range[];
	public activeCell?: Slick.Cell;

	constructor(public readonly resultId: number, public readonly batchId: number) {
		super();
	}

	public get canBeMaximized(): boolean | undefined {
		return this._canBeMaximized;
	}

	public set canBeMaximized(val: boolean | undefined) {
		if (isUndefined(val) || val === this._canBeMaximized) {
			return;
		}
		this._canBeMaximized = val;
		this._onCanBeMaximizedChange.fire(val);
	}

	public get maximized(): boolean | undefined {
		return this._maximized;
	}

	public set maximized(val: boolean | undefined) {
		if (isUndefined(val) || val === this._maximized) {
			return;
		}
		this._maximized = val;
		this._onMaximizedChange.fire(val);
	}
}
