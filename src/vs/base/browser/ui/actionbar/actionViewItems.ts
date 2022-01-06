/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isFirefox } from 'vs/base/browser/browser';
import { DataTransfers } from 'vs/base/browser/dnd';
import { $, addDisposableListener, append, EventHelper, EventLike, EventType } from 'vs/base/browser/dom';
import { EventType as TouchEventType, Gesture } from 'vs/base/browser/touch';
import { IActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ISelectBoxOptions, ISelectOptionItem, SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { Action, ActionRunner, IAction, IActionChangeEvent, IActionRunner, Separator } from 'vs/base/common/actions';
import { Disposable } from 'vs/base/common/lifecycle';
import * as platform from 'vs/base/common/platform';
import * as types from 'vs/base/common/types';
import 'vs/css!./actionbar';
import * as nls from 'vs/nls';

export interface IBaseActionViewItemOptions {
	draggable?: boolean;
	isMenu?: boolean;
	useEventAsContext?: boolean;
}

export class BaseActionViewItem extends Disposable implements IActionViewItem {

	element: HTMLElement | undefined;

	_context: unknown;
	_action: IAction;

	get action() {
		return this._action;
	}

	private _actionRunner: IActionRunner | undefined;

	constructor(context: unknown, action: IAction, protected options: IBaseActionViewItemOptions = {}) {
		super();

		this._context = context || this;
		this._action = action;

		if (action instanceof Action) {
			this._register(action.onDidChange(event => {
				if (!this.element) {
					// we have not been rendered yet, so there
					// is no point in updating the UI
					return;
				}

				this.handleActionChangeEvent(event);
			}));
		}
	}

	private handleActionChangeEvent(event: IActionChangeEvent): void {
		if (event.enabled !== undefined) {
			this.updateEnabled();
		}

		if (event.checked !== undefined) {
			this.updateChecked();
		}

		if (event.class !== undefined) {
			this.updateClass();
		}

		if (event.label !== undefined) {
			this.updateLabel();
			this.updateTooltip();
		}

		if (event.tooltip !== undefined) {
			this.updateTooltip();
		}

		// {{SQL CARBON EDIT}}
		if (event.expanded !== undefined) {
			this.updateExpanded();
		}
	}

	get actionRunner(): IActionRunner {
		if (!this._actionRunner) {
			this._actionRunner = this._register(new ActionRunner());
		}

		return this._actionRunner;
	}

	set actionRunner(actionRunner: IActionRunner) {
		this._actionRunner = actionRunner;
	}

	getAction(): IAction {
		return this._action;
	}

	isEnabled(): boolean {
		return this._action.enabled;
	}

	setActionContext(newContext: unknown): void {
		this._context = newContext;
	}

	render(container: HTMLElement): void {
		const element = this.element = container;
		this._register(Gesture.addTarget(container));

		const enableDragging = this.options && this.options.draggable;
		if (enableDragging) {
			container.draggable = true;

			if (isFirefox) {
				// Firefox: requires to set a text data transfer to get going
				this._register(addDisposableListener(container, EventType.DRAG_START, e => e.dataTransfer?.setData(DataTransfers.TEXT, this._action.label)));
			}
		}

		this._register(addDisposableListener(element, TouchEventType.Tap, e => this.onClick(e, true))); // Preserve focus on tap #125470

		this._register(addDisposableListener(element, EventType.MOUSE_DOWN, e => {
			if (!enableDragging) {
				EventHelper.stop(e, true); // do not run when dragging is on because that would disable it
			}

			if (this._action.enabled && e.button === 0) {
				element.classList.add('active');
			}
		}));

		if (platform.isMacintosh) {
			// macOS: allow to trigger the button when holding Ctrl+key and pressing the
			// main mouse button. This is for scenarios where e.g. some interaction forces
			// the Ctrl+key to be pressed and hold but the user still wants to interact
			// with the actions (for example quick access in quick navigation mode).
			this._register(addDisposableListener(element, EventType.CONTEXT_MENU, e => {
				if (e.button === 0 && e.ctrlKey === true) {
					this.onClick(e);
				}
			}));
		}

		this._register(addDisposableListener(element, EventType.CLICK, e => {
			EventHelper.stop(e, true);

			// menus do not use the click event
			if (!(this.options && this.options.isMenu)) {
				platform.setImmediate(() => this.onClick(e));
			}
		}));

		this._register(addDisposableListener(element, EventType.DBLCLICK, e => {
			EventHelper.stop(e, true);
		}));

		[EventType.MOUSE_UP, EventType.MOUSE_OUT].forEach(event => {
			this._register(addDisposableListener(element, event, e => {
				EventHelper.stop(e);
				element.classList.remove('active');
			}));
		});
	}

	onClick(event: EventLike, preserveFocus = false): void {
		EventHelper.stop(event, true);

		const context = types.isUndefinedOrNull(this._context) ? this.options?.useEventAsContext ? event : { preserveFocus } : this._context;
		this.actionRunner.run(this._action, context);
	}

	// Only set the tabIndex on the element once it is about to get focused
	// That way this element wont be a tab stop when it is not needed #106441
	focus(): void {
		if (this.element) {
			this.element.tabIndex = 0;
			this.element.focus();
			this.element.classList.add('focused');
		}
	}

	isFocused(): boolean {
		return !!this.element?.classList.contains('focused');
	}

	blur(): void {
		if (this.element) {
			this.element.blur();
			this.element.tabIndex = -1;
			this.element.classList.remove('focused');
		}
	}

	setFocusable(focusable: boolean): void {
		if (this.element) {
			this.element.tabIndex = focusable ? 0 : -1;
		}
	}

	get trapsArrowNavigation(): boolean {
		return false;
	}

	protected updateEnabled(): void {
		// implement in subclass
	}

	protected updateLabel(): void {
		// implement in subclass
	}

	protected updateTooltip(): void {
		// implement in subclass
	}

	protected updateClass(): void {
		// implement in subclass
	}

	protected updateChecked(): void {
		// implement in subclass
	}

	// {{SQL CARBON EDIT}}
	protected updateExpanded(): void {
		// implement in subclass
	}

	override dispose(): void {
		if (this.element) {
			this.element.remove();
			this.element = undefined;
		}

		super.dispose();
	}
}

export interface IActionViewItemOptions extends IBaseActionViewItemOptions {
	icon?: boolean;
	label?: boolean;
	keybinding?: string | null;
}

export class ActionViewItem extends BaseActionViewItem {

	protected label: HTMLElement | undefined;
	protected override options: IActionViewItemOptions;

	private cssClass?: string;

	constructor(context: unknown, action: IAction, options: IActionViewItemOptions = {}) {
		super(context, action, options);

		this.options = options;
		this.options.icon = options.icon !== undefined ? options.icon : false;
		this.options.label = options.label !== undefined ? options.label : true;
		this.cssClass = '';
	}

	override render(container: HTMLElement): void {
		super.render(container);

		if (this.element) {
			this.label = append(this.element, $('a.action-label'));
		}

		if (this.label) {
			if (this._action.id === Separator.ID) {
				this.label.setAttribute('role', 'presentation'); // A separator is a presentation item
			} else {
				if (this.options.isMenu) {
					this.label.setAttribute('role', 'menuitem');
				} else {
					this.label.setAttribute('role', 'button');
				}
			}
		}

		if (this.options.label && this.options.keybinding && this.element) {
			append(this.element, $('span.keybinding')).textContent = this.options.keybinding;
		}

		this.updateClass();
		this.updateLabel();
		this.updateTooltip();
		this.updateEnabled();
		this.updateChecked();
	}

	// Only set the tabIndex on the element once it is about to get focused
	// That way this element wont be a tab stop when it is not needed #106441
	override focus(): void {
		if (this.label) {
			this.label.tabIndex = 0;
			this.label.focus();
		}
	}

	override isFocused(): boolean {
		return !!this.label && this.label?.tabIndex === 0;
	}

	override blur(): void {
		if (this.label) {
			this.label.tabIndex = -1;
		}
	}

	override setFocusable(focusable: boolean): void {
		if (this.label) {
			this.label.tabIndex = focusable ? 0 : -1;
		}
	}

	override updateLabel(): void {
		if (this.options.label && this.label) {
			this.label.textContent = this.getAction().label;
		}
	}

	override updateTooltip(): void {
		let title: string | null = null;

		if (this.getAction().tooltip) {
			title = this.getAction().tooltip;

		} else if (!this.options.label && this.getAction().label && this.options.icon) {
			title = this.getAction().label;

			if (this.options.keybinding) {
				title = nls.localize({ key: 'titleLabel', comment: ['action title', 'action keybinding'] }, "{0} ({1})", title, this.options.keybinding);
			}
		}

		if (title && this.label) {
			this.label.title = title;
		}
	}

	override updateClass(): void {
		if (this.cssClass && this.label) {
			this.label.classList.remove(...this.cssClass.split(' '));
		}

		if (this.options.icon) {
			this.cssClass = this.getAction().class;

			if (this.label) {
				this.label.classList.add('codicon');
				if (this.cssClass) {
					// {{SQL CARBON EDIT}} - avoid exception if class contains empty elements
					let classList = this.cssClass.split(' ');
					let containsEmpty = false;
					if (classList && classList.length > 0) {
						for (let i = 0; i < classList.length; ++i) {
							if (classList[i] === undefined || classList[i] === '') {
								containsEmpty = true;
							}
						}
						if (!containsEmpty) {
							this.label.classList.add(...this.cssClass.split(' '));
						}
					}
				}
			}

			this.updateEnabled();
		} else {
			if (this.label) {
				this.label.classList.remove('codicon');
			}
		}
	}

	override updateEnabled(): void {
		if (this.getAction().enabled) {
			if (this.label) {
				this.label.removeAttribute('aria-disabled');
				this.label.classList.remove('disabled');
			}

			if (this.element) {
				this.element.classList.remove('disabled');
			}
		} else {
			if (this.label) {
				this.label.setAttribute('aria-disabled', 'true');
				this.label.classList.add('disabled');
			}

			if (this.element) {
				this.element.classList.add('disabled');
			}
		}
	}

	override updateChecked(): void {
		if (this.label) {
			if (this.getAction().checked) {
				this.label.classList.add('checked');
			} else {
				this.label.classList.remove('checked');
			}
		}
	}

	// {{SQL CARBON EDIT}}
	override updateExpanded(): void {
		if (this.label) {
			if (this.getAction().expanded !== undefined) {
				this.label.setAttribute('aria-expanded', `${this.getAction().expanded}`);
			} else {
				this.label.removeAttribute('aria-expanded');
			}
		}
	}
}

export class SelectActionViewItem extends BaseActionViewItem {
	protected selectBox: SelectBox;

	constructor(ctx: unknown, action: IAction, options: ISelectOptionItem[], selected: number, contextViewProvider: IContextViewProvider, selectBoxOptions?: ISelectBoxOptions) {
		super(ctx, action);

		this.selectBox = new SelectBox(options, selected, contextViewProvider, undefined, selectBoxOptions);
		this.selectBox.setFocusable(false);

		this._register(this.selectBox);
		this.registerListeners();
	}

	setOptions(options: ISelectOptionItem[], selected?: number): void {
		this.selectBox.setOptions(options, selected);
	}

	select(index: number): void {
		this.selectBox.select(index);
	}

	private registerListeners(): void {
		this._register(this.selectBox.onDidSelect(e => {
			this.actionRunner.run(this._action, this.getActionContext(e.selected, e.index));
		}));
	}

	protected getActionContext(option: string, index: number) {
		return option;
	}

	override setFocusable(focusable: boolean): void {
		this.selectBox.setFocusable(focusable);
	}

	override focus(): void {
		if (this.selectBox) {
			this.selectBox.focus();
		}
	}

	override blur(): void {
		if (this.selectBox) {
			this.selectBox.blur();
		}
	}

	override render(container: HTMLElement): void {
		this.selectBox.render(container);
	}
}
