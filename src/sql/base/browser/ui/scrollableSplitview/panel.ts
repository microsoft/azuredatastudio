/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Event, Emitter, chain } from 'vs/base/common/event';
import { domEvent } from 'vs/base/browser/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { $, append, addClass, removeClass, toggleClass, trackFocus } from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';

import { IView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';

export interface IPanelOptions {
	id: string;
	ariaHeaderLabel?: string;
	minimumBodySize?: number;
	maximumBodySize?: number;
	expanded?: boolean;
}

export interface IPanelStyles {
	dropBackground?: Color;
	headerForeground?: Color;
	headerBackground?: Color;
	headerHighContrastBorder?: Color;
}

/**
 * A Panel is a structured SplitView view.
 *
 * WARNING: You must call `render()` after you contruct it.
 * It can't be done automatically at the end of the ctor
 * because of the order of property initialization in TypeScript.
 * Subclasses wouldn't be able to set own properties
 * before the `render()` call, thus forbiding their use.
 */
export abstract class Panel implements IView {
	public id: string;

	private static readonly HEADER_SIZE = 22;

	protected _expanded: boolean;
	private expandedSize: number | undefined = undefined;
	private _headerVisible = true;
	private _minimumBodySize: number;
	private _maximumBodySize: number;
	private ariaHeaderLabel: string;
	private styles: IPanelStyles = {};

	readonly element: HTMLElement;
	private header: HTMLElement;
	protected disposables: IDisposable[] = [];

	private _onDidChange = new Emitter<number | undefined>();
	readonly onDidChange: Event<number | undefined> = this._onDidChange.event;

	get draggableElement(): HTMLElement {
		return this.header;
	}

	get dropTargetElement(): HTMLElement {
		return this.element;
	}

	private _dropBackground: Color | undefined;
	get dropBackground(): Color | undefined {
		return this._dropBackground;
	}

	get minimumBodySize(): number {
		return this._minimumBodySize;
	}

	set minimumBodySize(size: number) {
		this._minimumBodySize = size;
		this._onDidChange.fire();
	}

	get maximumBodySize(): number {
		return this._maximumBodySize;
	}

	set maximumBodySize(size: number) {
		this._maximumBodySize = size;
		this._onDidChange.fire();
	}

	private get headerSize(): number {
		return this.headerVisible ? Panel.HEADER_SIZE : 0;
	}

	get minimumSize(): number {
		const headerSize = this.headerSize;
		const expanded = !this.headerVisible || this.isExpanded();
		const minimumBodySize = expanded ? this._minimumBodySize : 0;

		return headerSize + minimumBodySize;
	}

	get maximumSize(): number {
		const headerSize = this.headerSize;
		const expanded = !this.headerVisible || this.isExpanded();
		const maximumBodySize = expanded ? this._maximumBodySize : 0;

		return headerSize + maximumBodySize;
	}

	constructor(options: IPanelOptions) {
		this.id = options.id;
		this._expanded = typeof options.expanded === 'undefined' ? true : !!options.expanded;
		this.ariaHeaderLabel = options.ariaHeaderLabel || '';
		this._minimumBodySize = typeof options.minimumBodySize === 'number' ? options.minimumBodySize : 120;
		this._maximumBodySize = typeof options.maximumBodySize === 'number' ? options.maximumBodySize : Number.POSITIVE_INFINITY;

		this.element = $('.panel');
	}

	isExpanded(): boolean {
		return this._expanded;
	}

	setExpanded(expanded: boolean): void {
		if (this._expanded === !!expanded) {
			return;
		}

		this._expanded = !!expanded;
		this.updateHeader();
		this._onDidChange.fire(expanded ? this.expandedSize : undefined);
	}

	get headerVisible(): boolean {
		return this._headerVisible;
	}

	set headerVisible(visible: boolean) {
		if (this._headerVisible === !!visible) {
			return;
		}

		this._headerVisible = !!visible;
		this.updateHeader();
		this._onDidChange.fire();
	}

	render(container: HTMLElement): void {
		append(container, this.element);
		this.header = $('.panel-header');
		append(this.element, this.header);
		this.header.setAttribute('tabindex', '0');
		this.header.setAttribute('role', 'toolbar');
		this.header.setAttribute('aria-label', this.ariaHeaderLabel);
		this.renderHeader(this.header);

		const focusTracker = trackFocus(this.header);
		focusTracker.onDidFocus(() => addClass(this.header, 'focused'));
		focusTracker.onDidBlur(() => removeClass(this.header, 'focused'));

		this.updateHeader();

		const onHeaderKeyDown = chain(domEvent(this.header, 'keydown'))
			.map(e => new StandardKeyboardEvent(e));

		onHeaderKeyDown.filter(e => e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space)
			.event(() => this.setExpanded(!this.isExpanded()), null, this.disposables);

		onHeaderKeyDown.filter(e => e.keyCode === KeyCode.LeftArrow)
			.event(() => this.setExpanded(false), null, this.disposables);

		onHeaderKeyDown.filter(e => e.keyCode === KeyCode.RightArrow)
			.event(() => this.setExpanded(true), null, this.disposables);

		domEvent(this.header, 'click')
			(() => this.setExpanded(!this.isExpanded()), null, this.disposables);

		// TODO@Joao move this down to panelview
		// onHeaderKeyDown.filter(e => e.keyCode === KeyCode.UpArrow)
		// 	.event(focusPrevious, this, this.disposables);

		// onHeaderKeyDown.filter(e => e.keyCode === KeyCode.DownArrow)
		// 	.event(focusNext, this, this.disposables);

		const body = append(this.element, $('.panel-body'));
		this.renderBody(body);
	}

	layout(size: number): void {
		const headerSize = this.headerVisible ? Panel.HEADER_SIZE : 0;
		this.layoutBody(size - headerSize);

		if (this.isExpanded()) {
			this.expandedSize = size;
		}
	}

	style(styles: IPanelStyles): void {
		this.styles = styles;

		if (!this.header) {
			return;
		}

		this.updateHeader();
	}

	protected updateHeader(): void {
		const expanded = !this.headerVisible || this.isExpanded();

		this.header.style.height = `${this.headerSize}px`;
		this.header.style.lineHeight = `${this.headerSize}px`;
		toggleClass(this.header, 'hidden', !this.headerVisible);
		toggleClass(this.header, 'expanded', expanded);
		this.header.setAttribute('aria-expanded', String(expanded));

		this.header.style.color = this.styles.headerForeground ? this.styles.headerForeground.toString() : null;
		this.header.style.backgroundColor = this.styles.headerBackground ? this.styles.headerBackground.toString() : null;
		this.header.style.borderTop = this.styles.headerHighContrastBorder ? `1px solid ${this.styles.headerHighContrastBorder}` : null;
		this._dropBackground = this.styles.dropBackground;
	}

	protected abstract renderHeader(container: HTMLElement): void;
	protected abstract renderBody(container: HTMLElement): void;
	protected abstract layoutBody(size: number): void;

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
