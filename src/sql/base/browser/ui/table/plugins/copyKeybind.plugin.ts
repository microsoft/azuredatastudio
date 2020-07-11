/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Emitter, Event } from 'vs/base/common/event';
import { isUndefinedOrNull } from 'vs/base/common/types';

/**
 * Implements the various additional navigation  keybindings we want out of slickgrid
 */
export class CopyKeybind<T> implements Slick.Plugin<T> {
	private grid!: Slick.Grid<T>;
	private handler = new Slick.EventHandler();

	private _onCopy = new Emitter<Slick.Range[]>();
	public onCopy: Event<Slick.Range[]> = this._onCopy.event;

	public init(grid: Slick.Grid<T>) {
		this.grid = grid;
		this.handler.subscribe(this.grid.onKeyDown, (e: DOMEvent, args: Slick.OnKeyDownEventArgs<T>) => this.handleKeyDown(e as KeyboardEvent, args));
	}

	public destroy() {
		this.handler.unsubscribeAll();
	}

	private handleKeyDown(e: KeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		let event = new StandardKeyboardEvent(e);
		let handled = false;

		if (event.equals(KeyCode.KEY_C | KeyMod.CtrlCmd)) {
			handled = true;
			let selectionModel = this.grid.getSelectionModel();
			let ranges: Slick.Range[];
			// check to see if we can get the range from the model directly
			if (selectionModel) {
				ranges = selectionModel.getSelectedRanges();
			} else {
				let selectedRows = this.grid.getSelectedRows();
				let startColumn = 0;
				// check for number column
				if (!isUndefinedOrNull(this.grid.getColumns()[0].selectable) && !this.grid.getColumns()[0].selectable) {
					startColumn = 1;
				}
				ranges = [new Slick.Range(selectedRows[0], startColumn, selectedRows[selectedRows.length - 1], this.grid.getColumns().length)];
			}
			this._onCopy.fire(ranges);
		}

		if (handled) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	}

}
