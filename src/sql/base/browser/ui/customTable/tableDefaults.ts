/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as _ from './table';
import * as mouse from 'vs/base/browser/mouseEvent';
import * as touch from 'vs/base/browser/touch';
import * as keyboard from 'vs/base/browser/keyboardEvent';
import * as platform from 'vs/base/common/platform';
import { KeybindingDispatcher, ClickBehavior } from 'vs/base/parts/tree/browser/treeDefaults';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';

export interface IControllerOptions {
	clickBehavior?: ClickBehavior;
	// openMode?: OpenMode;
	keyboardSupport?: boolean;
}

export class DefaultController implements _.IController {
	protected downKeyBindingDispatcher: KeybindingDispatcher;
	protected upKeyBindingDispatcher: KeybindingDispatcher;

	constructor(private options: IControllerOptions = { clickBehavior: ClickBehavior.ON_MOUSE_DOWN, keyboardSupport: true /*, openMode: OpenMode.SINGLE_CLICK */ }) {
		this.options = options;

		this.downKeyBindingDispatcher = new KeybindingDispatcher();
		this.upKeyBindingDispatcher = new KeybindingDispatcher();

		if (typeof options.keyboardSupport !== 'boolean' || options.keyboardSupport) {
			this.downKeyBindingDispatcher.set(KeyCode.UpArrow, (t, e) => this.onUp(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.DownArrow, (t, e) => this.onDown(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.LeftArrow, (t, e) => this.onLeft(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.RightArrow, (t, e) => this.onRight(t, e));
			if (platform.isMacintosh) {
				this.downKeyBindingDispatcher.set(KeyMod.CtrlCmd | KeyCode.UpArrow, (t, e) => this.onLeft(t, e));
				this.downKeyBindingDispatcher.set(KeyMod.WinCtrl | KeyCode.KEY_N, (t, e) => this.onDown(t, e));
				this.downKeyBindingDispatcher.set(KeyMod.WinCtrl | KeyCode.KEY_P, (t, e) => this.onUp(t, e));
			}
			this.downKeyBindingDispatcher.set(KeyCode.PageUp, (t, e) => this.onPageUp(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.PageDown, (t, e) => this.onPageDown(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.Home, (t, e) => this.onHome(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.End, (t, e) => this.onEnd(t, e));

			this.downKeyBindingDispatcher.set(KeyCode.Space, (t, e) => this.onSpace(t, e));
			this.downKeyBindingDispatcher.set(KeyCode.Escape, (t, e) => this.onEscape(t, e));

			this.upKeyBindingDispatcher.set(KeyCode.Enter, this.onEnter.bind(this));
			this.upKeyBindingDispatcher.set(KeyMod.CtrlCmd | KeyCode.Enter, this.onEnter.bind(this));
		}
	}

	public onClick(tree: _.ITable, element: any, event: mouse.IMouseEvent): boolean {
		throw new Error("Method not implemented.");
	}

	public onContextMenu(tree: _.ITable, element: any, event: _.ContextMenuEvent): boolean {
		throw new Error("Method not implemented.");
	}

	public onTap(tree: _.ITable, element: any, event: touch.GestureEvent): boolean {
		throw new Error("Method not implemented.");
	}

	public onKeyDown(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	public onKeyUp(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	public onMouseDown?(tree: _.ITable, element: any, event: mouse.IMouseEvent): boolean {
		throw new Error("Method not implemented.");
	}

	public onMouseUp?(tree: _.ITable, element: any, event: mouse.IMouseEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onUp(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onDown(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onLeft(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onRight(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onPageUp(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onPageDown(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onHome(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onEnd(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onSpace(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onEscape(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}

	protected onEnter(tree: _.ITable, event: keyboard.IKeyboardEvent): boolean {
		throw new Error("Method not implemented.");
	}
}
