/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IContextMenuProvider } from 'vs/base/browser/contextmenu';
import { addDisposableListener, EventHelper, EventType, IFocusTracker, removeTabIndexAndUpdateFocus, reset, trackFocus } from 'vs/base/browser/dom';
import { sanitize } from 'vs/base/browser/dompurify/dompurify';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { renderMarkdown, renderStringAsPlaintext } from 'vs/base/browser/markdownRenderer';
import { Gesture, EventType as TouchEventType } from 'vs/base/browser/touch';
import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { Action, IAction, IActionRunner } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { Color } from 'vs/base/common/color';
import { Event as BaseEvent, Emitter } from 'vs/base/common/event';
import { IMarkdownString, isMarkdownString, markdownStringEqual } from 'vs/base/common/htmlContent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ThemeIcon } from 'vs/base/common/themables';
import 'vs/css!./button';
import { localize } from 'vs/nls';

export interface IButtonOptions extends Partial<IButtonStyles> {
	readonly title?: boolean | string;
	readonly supportIcons?: boolean;
	readonly supportShortLabel?: boolean;
	readonly secondary?: boolean;
}

export interface IButtonStyles {
	readonly buttonBackground: string | undefined;
	readonly buttonHoverBackground: string | undefined;
	readonly buttonForeground: string | undefined;
	readonly buttonSeparator: string | undefined;
	readonly buttonSecondaryBackground: string | undefined;
	readonly buttonSecondaryHoverBackground: string | undefined;
	readonly buttonSecondaryForeground: string | undefined;
	readonly buttonBorder: string | undefined;
	// {{SQL CARBON EDIT}} - Start
	readonly buttonSecondaryBorder: string | undefined;
	readonly buttonDisabledBackground: string | undefined;
	readonly buttonDisabledForeground: string | undefined;
	readonly buttonDisabledBorder: string | undefined;
	// {{SQL CARBON EDIT}} - End
}

export const unthemedButtonStyles: IButtonStyles = {
	buttonBackground: '#0E639C',
	buttonHoverBackground: '#006BB3',
	buttonSeparator: Color.white.toString(),
	buttonForeground: Color.white.toString(),
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	// {{SQL CARBON EDIT}} - Start
	buttonSecondaryBorder: undefined,
	buttonDisabledBackground: undefined,
	buttonDisabledForeground: undefined,
	buttonDisabledBorder: undefined
	// {{SQL CARBON EDIT}} - End
};

export interface IButton extends IDisposable {
	readonly element: HTMLElement;
	readonly onDidClick: BaseEvent<Event | undefined>;

	set label(value: string | IMarkdownString);
	set icon(value: ThemeIcon | string); // {{SQL CARBON EDIT}} - add string to the value type.
	set enabled(value: boolean);

	focus(): void;
	hasFocus(): boolean;
}

export interface IButtonWithDescription extends IButton {
	description: string;
}

export class Button extends Disposable implements IButton {

	protected options: IButtonOptions;
	protected _element: HTMLElement;
	protected _label: string | IMarkdownString = '';
	protected _labelElement: HTMLElement | undefined;
	protected _labelShortElement: HTMLElement | undefined;
	// {{SQL CARBON EDIT}} - Start
	private hasIcon: boolean = false;
	// {{SQL CARBON EDIT}} - End

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private focusTracker: IFocusTracker;

	constructor(container: HTMLElement, options: IButtonOptions) {
		super();

		this.options = options;

		this._element = document.createElement('a');
		this._element.classList.add('monaco-button');
		this._element.tabIndex = 0;
		this._element.setAttribute('role', 'button');

		const background = options.secondary ? options.buttonSecondaryBackground : options.buttonBackground;
		const foreground = options.secondary ? options.buttonSecondaryForeground : options.buttonForeground;

		this._element.style.color = foreground || '';
		this._element.style.backgroundColor = background || '';

		if (options.supportShortLabel) {
			this._labelShortElement = document.createElement('div');
			this._labelShortElement.classList.add('monaco-button-label-short');
			this._element.appendChild(this._labelShortElement);

			this._labelElement = document.createElement('div');
			this._labelElement.classList.add('monaco-button-label');
			this._element.appendChild(this._labelElement);

			this._element.classList.add('monaco-text-button-with-short-label');
		}

		container.appendChild(this._element);

		this._register(Gesture.addTarget(this._element));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(this._element, eventType, e => {
				if (!this.enabled) {
					EventHelper.stop(e);
					return;
				}

				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = false;
			if (this.enabled && (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space))) {
				this._onDidClick.fire(e);
				eventHandled = true;
			} else if (event.equals(KeyCode.Escape)) {
				this._element.blur();
				eventHandled = true;
			}

			if (eventHandled) {
				EventHelper.stop(event, true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.updateBackground(true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.updateBackground(false); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => { if (this.enabled) { this.updateBackground(true); } }));
		this._register(this.focusTracker.onDidBlur(() => { if (this.enabled) { this.updateBackground(false); } }));
		// {{SQL CARBON EDIT}} - Start
		this.updateStyles();
		// {{SQL CARBON EDIT}} - End
	}

	private getContentElements(content: string): HTMLElement[] {
		const elements: HTMLSpanElement[] = [];
		for (let segment of renderLabelWithIcons(content)) {
			if (typeof (segment) === 'string') {
				segment = segment.trim();

				// Ignore empty segment
				if (segment === '') {
					continue;
				}

				// Convert string segments to <span> nodes
				const node = document.createElement('span');
				node.textContent = segment;
				elements.push(node);
			} else {
				elements.push(segment);
			}
		}

		return elements;
	}

	// {{ SQL CARBON EDIT}} - Mark as protected
	protected updateBackground(hover: boolean): void {
		// // {{SQL CARBON EDIT}} - Start
		if (!this.enabled || this.hasIcon) {
			return;
		}
		// {{SQL CARBON EDIT}} - End
		let background;
		if (this.options.secondary) {
			background = hover ? this.options.buttonSecondaryHoverBackground : this.options.buttonSecondaryBackground;
		} else {
			background = hover ? this.options.buttonHoverBackground : this.options.buttonBackground;
		}
		if (background) {
			this._element.style.backgroundColor = background;
		}
	}

	// {{SQL CARBON EDIT}} - Start
	protected updateStyles(): void {
		let background, foreground, border, fontWeight, fontSize: string;
		if (this.hasIcon) {
			background = border = 'transparent';
			foreground = 'inherit';
			fontWeight = fontSize = 'inherit';
			this._element.style.backgroundRepeat = 'no-repeat';
		} else {
			if (this.enabled) {
				if (this.options.secondary) {
					foreground = this.options.buttonSecondaryForeground;
					background = this.options.buttonSecondaryBackground;
					border = this.options.buttonSecondaryBorder;
				} else {
					foreground = this.options.buttonForeground;
					background = this.options.buttonBackground;
					border = this.options.buttonBorder;
				}
			}
			else {
				foreground = this.options.buttonDisabledForeground;
				background = this.options.buttonDisabledBackground;
				border = this.options.buttonDisabledBorder;
			}
			fontWeight = '600';
			fontSize = '12px';
		}
		this._element.style.color = foreground || '';
		this._element.style.backgroundColor = background || '';
		this._element.style.borderWidth = border ? '1px' : '';
		this._element.style.borderStyle = border ? 'solid' : '';
		this._element.style.borderColor = border || '';
		this._element.style.opacity = this.hasIcon ? '' : '1';
		this._element.style.fontWeight = fontWeight;
		this._element.style.fontSize = fontSize;
		this._element.style.borderRadius = '2px';
	}
	// {{SQL CARBON EDIT}} - End

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string | IMarkdownString) {
		if (this._label === value) {
			return;
		}

		if (isMarkdownString(this._label) && isMarkdownString(value) && markdownStringEqual(this._label, value)) {
			return;
		}

		this._element.classList.add('monaco-text-button');
		const labelElement = this.options.supportShortLabel ? this._labelElement! : this._element;

		if (isMarkdownString(value)) {
			const rendered = renderMarkdown(value, { inline: true });
			rendered.dispose();

			// Don't include outer `<p>`
			const root = rendered.element.querySelector('p')?.innerHTML;
			if (root) {
				// Only allow a very limited set of inline html tags
				const sanitized = sanitize(root, { ADD_TAGS: ['b', 'i', 'u', 'code', 'span'], ALLOWED_ATTR: ['class'], RETURN_TRUSTED_TYPE: true });
				labelElement.innerHTML = sanitized as unknown as string;
			} else {
				reset(labelElement);
			}
		} else {
			if (this.options.supportIcons) {
				reset(labelElement, ...this.getContentElements(value));
			} else {
				labelElement.textContent = value;
			}
		}
		this._element.setAttribute('aria-label', <any>value); // {{SQL CARBON EDIT}}
		if (typeof this.options.title === 'string') {
			this._element.title = this.options.title;
		} else if (this.options.title) {
			this._element.title = renderStringAsPlaintext(value);
		}

		this._label = value;
	}

	get label(): string | IMarkdownString {
		return this._label;
	}

	set labelShort(value: string) {
		if (!this.options.supportShortLabel || !this._labelShortElement) {
			return;
		}

		if (this.options.supportIcons) {
			reset(this._labelShortElement, ...this.getContentElements(value));
		} else {
			this._labelShortElement.textContent = value;
		}
	}

	// {{SQL CARBON EDIT}} - accept class name directly
	set icon(icon: ThemeIcon | string) {
		if (typeof icon === 'string') {
			this._element.classList.add(...icon.split(' '));
		} else {
			this._element.classList.add(...ThemeIcon.asClassNameArray(icon));
		}
		this.hasIcon = icon !== undefined;
		this.updateStyles();
	}
	// {{SQL CARBON EDIT}} - End

	set enabled(value: boolean) {
		if (value) {
			this._element.classList.remove('disabled');
			this._element.setAttribute('aria-disabled', String(false));
			this._element.tabIndex = 0;
		} else {
			this._element.classList.add('disabled');
			this._element.setAttribute('aria-disabled', String(true));
			removeTabIndexAndUpdateFocus(this._element); // {{SQL CARBON EDIT}} - remove tabindex when disabled otherwise disabled control is still keyboard focusable.
		}
		// {{SQL CARBON EDIT}} - Start
		this.updateStyles();
		// {{SQL CARBON EDIT}} - End
	}

	get enabled() {
		return !this._element.classList.contains('disabled');
	}

	focus(): void {
		this._element.focus();
	}

	hasFocus(): boolean {
		return this._element === document.activeElement;
	}
}

export interface IButtonWithDropdownOptions extends IButtonOptions {
	readonly contextMenuProvider: IContextMenuProvider;
	readonly actions: IAction[];
	readonly actionRunner?: IActionRunner;
	readonly addPrimaryActionToDropdown?: boolean;
}

export class ButtonWithDropdown extends Disposable implements IButton {

	private readonly button: Button;
	private readonly action: Action;
	private readonly dropdownButton: Button;
	private readonly separatorContainer: HTMLDivElement;
	private readonly separator: HTMLDivElement;

	readonly element: HTMLElement;
	private readonly _onDidClick = this._register(new Emitter<Event | undefined>());
	readonly onDidClick = this._onDidClick.event;

	constructor(container: HTMLElement, options: IButtonWithDropdownOptions) {
		super();

		this.element = document.createElement('div');
		this.element.classList.add('monaco-button-dropdown');
		container.appendChild(this.element);

		this.button = this._register(new Button(this.element, options));
		this._register(this.button.onDidClick(e => this._onDidClick.fire(e)));
		this.action = this._register(new Action('primaryAction', renderStringAsPlaintext(this.button.label), undefined, true, async () => this._onDidClick.fire(undefined)));

		this.separatorContainer = document.createElement('div');
		this.separatorContainer.classList.add('monaco-button-dropdown-separator');

		this.separator = document.createElement('div');
		this.separatorContainer.appendChild(this.separator);
		this.element.appendChild(this.separatorContainer);

		// Separator styles
		const border = options.buttonBorder;
		if (border) {
			this.separatorContainer.style.borderTop = '1px solid ' + border;
			this.separatorContainer.style.borderBottom = '1px solid ' + border;
		}

		const buttonBackground = options.secondary ? options.buttonSecondaryBackground : options.buttonBackground;
		this.separatorContainer.style.backgroundColor = buttonBackground ?? '';
		this.separator.style.backgroundColor = options.buttonSeparator ?? '';

		this.dropdownButton = this._register(new Button(this.element, { ...options, title: false, supportIcons: true }));
		this.dropdownButton.element.title = localize("button dropdown more actions", 'More Actions...');
		this.dropdownButton.element.setAttribute('aria-haspopup', 'true');
		this.dropdownButton.element.setAttribute('aria-expanded', 'false');
		this.dropdownButton.element.classList.add('monaco-dropdown-button');
		this.dropdownButton.icon = Codicon.dropDownButton;
		this._register(this.dropdownButton.onDidClick(e => {
			options.contextMenuProvider.showContextMenu({
				getAnchor: () => this.dropdownButton.element,
				getActions: () => options.addPrimaryActionToDropdown === false ? [...options.actions] : [this.action, ...options.actions],
				actionRunner: options.actionRunner,
				onHide: () => this.dropdownButton.element.setAttribute('aria-expanded', 'false')
			});
			this.dropdownButton.element.setAttribute('aria-expanded', 'true');
		}));
	}

	set label(value: string) {
		this.button.label = value;
		this.action.label = value;
	}

	set icon(icon: ThemeIcon) {
		this.button.icon = icon;
	}

	set enabled(enabled: boolean) {
		this.button.enabled = enabled;
		this.dropdownButton.enabled = enabled;

		this.element.classList.toggle('disabled', !enabled);
	}

	get enabled(): boolean {
		return this.button.enabled;
	}

	focus(): void {
		this.button.focus();
	}

	hasFocus(): boolean {
		return this.button.hasFocus() || this.dropdownButton.hasFocus();
	}
}

export class ButtonWithDescription implements IButtonWithDescription {
	private _button: Button;
	private _element: HTMLElement;
	private _descriptionElement: HTMLElement;

	constructor(container: HTMLElement, private readonly options: IButtonOptions) {
		this._element = document.createElement('div');
		this._element.classList.add('monaco-description-button');
		this._button = new Button(this._element, options);

		this._descriptionElement = document.createElement('div');
		this._descriptionElement.classList.add('monaco-button-description');
		this._element.appendChild(this._descriptionElement);

		container.appendChild(this._element);
	}

	get onDidClick(): BaseEvent<Event | undefined> {
		return this._button.onDidClick;
	}

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string) {
		this._button.label = value;
	}

	set icon(icon: ThemeIcon) {
		this._button.icon = icon;
	}

	get enabled(): boolean {
		return this._button.enabled;
	}

	set enabled(enabled: boolean) {
		this._button.enabled = enabled;
	}

	focus(): void {
		this._button.focus();
	}
	hasFocus(): boolean {
		return this._button.hasFocus();
	}
	dispose(): void {
		this._button.dispose();
	}

	set description(value: string) {
		if (this.options.supportIcons) {
			reset(this._descriptionElement, ...renderLabelWithIcons(value));
		} else {
			this._descriptionElement.textContent = value;
		}
	}
}

export class ButtonBar extends Disposable {

	private _buttons: IButton[] = [];

	constructor(private readonly container: HTMLElement) {
		super();
	}

	get buttons(): IButton[] {
		return this._buttons;
	}

	addButton(options: IButtonOptions): IButton {
		const button = this._register(new Button(this.container, options));
		this.pushButton(button);
		return button;
	}

	addButtonWithDescription(options: IButtonOptions): IButtonWithDescription {
		const button = this._register(new ButtonWithDescription(this.container, options));
		this.pushButton(button);
		return button;
	}

	addButtonWithDropdown(options: IButtonWithDropdownOptions): IButton {
		const button = this._register(new ButtonWithDropdown(this.container, options));
		this.pushButton(button);
		return button;
	}

	private pushButton(button: IButton): void {
		this._buttons.push(button);

		const index = this._buttons.length - 1;
		this._register(addDisposableListener(button.element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = true;

			// Next / Previous Button
			let buttonIndexToFocus: number | undefined;
			if (event.equals(KeyCode.LeftArrow)) {
				buttonIndexToFocus = index > 0 ? index - 1 : this._buttons.length - 1;
			} else if (event.equals(KeyCode.RightArrow)) {
				buttonIndexToFocus = index === this._buttons.length - 1 ? 0 : index + 1;
			} else {
				eventHandled = false;
			}

			if (eventHandled && typeof buttonIndexToFocus === 'number') {
				this._buttons[buttonIndexToFocus].focus();
				EventHelper.stop(e, true);
			}

		}));
	}
}
