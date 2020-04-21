/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/toolbarLayout';

import * as DOM from 'vs/base/browser/dom';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ElementRef, OnDestroy, AfterViewInit, ViewChild
} from '@angular/core';

import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponentDescriptor, IComponent, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { debounce } from 'vs/base/common/decorators';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { EDITOR_PANE_BACKGROUND, TOOLBAR_OVERFLOW_SHADOW, DASHBOARD_BORDER } from 'vs/workbench/common/theme';

export enum Orientation {
	Horizontal = 'horizontal',
	Vertical = 'vertial'
}

export interface ToolbarLayout {
	orientation: Orientation;
	overflow?: boolean;
}

export interface ToolbarItemConfig {
	title?: string;
	toolbarSeparatorAfter?: boolean;
}

export class ToolbarItem {
	constructor(public descriptor: IComponentDescriptor, public config: ToolbarItemConfig) { }
}

@Component({
	selector: 'modelview-toolbarContainer',
	template: `
		<div #container *ngIf="items" [class]="toolbarClass" >
			<ng-container *ngFor="let item of items">
			<div class="modelview-toolbar-item" [style.paddingTop]="paddingTop">
				<div *ngIf="shouldShowTitle(item)" class="modelview-toolbar-title" >
					{{getItemTitle(item)}}
				</div>
				<div class="modelview-toolbar-component">
					<model-component-wrapper  [descriptor]="item.descriptor" [modelStore]="modelStore" >
					</model-component-wrapper>
				</div>
				<div *ngIf="shouldShowToolbarSeparator(item)" class="taskbarSeparator" >
				</div>
			</div>
			</ng-container>
			<a #moreActionsButton class="moreActions action-label codicon toggle-more" role="button" tabindex="0" aria-haspopup="true"> </a>
		</div>
		<div #overflow class="toolbar-overflow" role="menu">
		</div>
	`
})
export default class ToolbarContainer extends ContainerBase<ToolbarItemConfig> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;
	@ViewChild('overflow', { read: ElementRef }) private _overflowContainer: ElementRef;
	@ViewChild('moreActionsButton', { read: ElementRef }) private _moreAcionsButton: ElementRef;

	private _orientation: Orientation;
	private _overflow: boolean = false;
	private _overflowCurrentIndex;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
		this._orientation = Orientation.Horizontal;
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	ngAfterViewInit(): void {
	}

	@debounce(300)
	private resizeToolbar(): void {
		let width = this._container.nativeElement.offsetWidth;
		let fullWidth = this._container.nativeElement.scrollWidth;

		if (width < fullWidth) {
			this._moreAcionsButton.nativeElement.style.display = 'block';
			while (width < fullWidth) {
				let index = this.items.length - 1;
				if (index > -1) {
					this.collapseItem();
					fullWidth = this._container.nativeElement.scrollWidth;
				} else {
					break;
				}
			}
		} else if (this._overflowContainer.nativeElement.children.length > 0) {
			do {
				this.unCollapseItem();

				// too big
				if (this._container.nativeElement.scrollWidth > this._container.nativeElement.offsetWidth) {
					this.collapseItem();
					break;
				}
			} while (width === fullWidth && this._overflowContainer.nativeElement.children.length > 0);

			if (this._overflowContainer.nativeElement.children.length === 0) {
				this._moreAcionsButton.nativeElement.style.display = 'none';
			}
		}
	}

	private collapseItem(): void {
		let lastChild = this._container.nativeElement.children[this._container.nativeElement.childElementCount - 2];
		let element = this._container.nativeElement.removeChild(lastChild);
		this._overflowContainer.nativeElement.insertBefore(element, this._overflowContainer.nativeElement.firstChild);

		this._register(DOM.addDisposableListener(element, DOM.EventType.CLICK, (e => { this.hideOverflowDisplay(); })));

		// change role to menuItem when it's in the overflow
		let item = this.findFocusableElement(element);
		item.setAttribute('role', 'menuItem');
	}

	private unCollapseItem(): void {
		let firstChild = this._overflowContainer.nativeElement.children[0];
		let element = this._overflowContainer.nativeElement.removeChild(firstChild);
		this._container.nativeElement.insertBefore(element, this._container.nativeElement.lastElementChild);

		// change role to back to button when it's in the toolbar
		let item = this.findFocusableElement(element);
		item.setAttribute('role', 'button');
	}

	private hideOverflowDisplay(): void {
		this._overflowContainer.nativeElement.style.display = 'none';
	}

	private moreElementOnClick(event: MouseEvent | StandardKeyboardEvent): void {
		this._overflowContainer.nativeElement.style.display = this._overflowContainer.nativeElement.style.display === 'block' ? 'none' : 'block';
		this._overflowCurrentIndex = undefined;
		if (this._overflowContainer.nativeElement.style.display === 'block') {
			this.focusNext();
		}
		DOM.EventHelper.stop(event, true);
	}

	private focusNext(): void {
		if (this._overflowCurrentIndex === undefined) {
			this._overflowCurrentIndex = this._overflowContainer.nativeElement.children.length - 1;
		}

		let startIndex = this._overflowCurrentIndex;
		// down arrow on last element should move focus to the first element of the overflow
		do {
			this._overflowCurrentIndex = (this._overflowCurrentIndex + 1) % this._overflowContainer.nativeElement.children.length;
		} while (this._overflowCurrentIndex !== startIndex && !this.isEnabled(this.findFocusableElement(this._overflowContainer.nativeElement.children[this._overflowCurrentIndex])));

		let current = this._overflowContainer.nativeElement.children[this._overflowCurrentIndex];
		current = this.findFocusableElement(current);
		(<HTMLElement>current).focus();
	}

	private focusPrevious(): void {
		let startIndex = this._overflowCurrentIndex;
		// up arrow on first element in overflow should move focus to the bottom of the overflow
		do {
			--this._overflowCurrentIndex;
			if (this._overflowCurrentIndex < 0) {
				this._overflowCurrentIndex = this._overflowContainer.nativeElement.children.length - 1;
			}
		} while (this._overflowCurrentIndex !== startIndex && !this.isEnabled(this.findFocusableElement(this._overflowContainer.nativeElement.children[this._overflowCurrentIndex])));

		let current = this._overflowContainer.nativeElement.children[this._overflowCurrentIndex];
		current = this.findFocusableElement(current);
		(<HTMLElement>current).focus();
	}

	private findFocusableElement(element: any): HTMLElement {
		let current = element;
		while (current.children && current.children[0]) {
			current = current.children[0];
		}

		return current;
	}

	private isEnabled(element: HTMLElement): boolean {
		return !element.className.includes('disabled');
	}

	private addOverflowListeners(): void {
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.resizeToolbar();
		}));

		this._register(DOM.addDisposableListener(this._overflowContainer.nativeElement, DOM.EventType.FOCUS_OUT, e => {
			if (this._overflowContainer && !DOM.isAncestor(e.relatedTarget as HTMLElement, this._overflowContainer.nativeElement) && e.relatedTarget !== this._moreAcionsButton.nativeElement) {
				this.hideOverflowDisplay();
			}
		}));

		this._register(DOM.addDisposableListener(this._overflowContainer.nativeElement, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);

			if (event.equals(KeyCode.UpArrow)) {
				this.focusPrevious();
			} else if (event.equals(KeyCode.DownArrow)) {
				this.focusNext();
			} else if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				this.hideOverflowDisplay();
				(<HTMLElement>this._moreAcionsButton.nativeElement).focus();
			} else if (event.equals(KeyCode.Tab)) {
				this.hideOverflowDisplay();
			}
			DOM.EventHelper.stop(event, true);
		}));

		this._register(DOM.addDisposableListener(this._moreAcionsButton.nativeElement, DOM.EventType.KEY_UP, (ev => {
			let event = new StandardKeyboardEvent(ev);
			if (event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) {
				this.moreElementOnClick(event);
			}
		})));

		this._register(DOM.addDisposableListener(this._moreAcionsButton.nativeElement, DOM.EventType.CLICK, (e => { this.moreElementOnClick(e); })));
	}

	/// IComponent implementation

	public setLayout(layout: ToolbarLayout): void {
		this._orientation = layout.orientation ? layout.orientation : Orientation.Horizontal;
		this._overflow = layout.overflow ? layout.overflow : true;

		if (this._overflow) {
			this.addOverflowListeners();
			this.resizeToolbar();
		}

		this.layout();
	}

	public getItemTitle(item: ToolbarItem): string {
		let itemConfig = item.config;
		return itemConfig ? itemConfig.title : '';
	}

	public shouldShowTitle(item: ToolbarItem): boolean {
		return this.hasTitle(item) && this.isHorizontal();
	}

	public shouldShowToolbarSeparator(item: ToolbarItem): boolean {
		if (!item || !item.config) {
			return false;
		}
		return item.config.toolbarSeparatorAfter;
	}

	private hasTitle(item: ToolbarItem): boolean {
		return item && item.config && item.config.title !== undefined;
	}

	public get paddingTop(): string {
		return this.isHorizontal() ? '' : '';
	}

	public get toolbarClass(): string {
		let classes = ['modelview-toolbar-container'];
		if (this.isHorizontal()) {
			classes.push('toolbar-horizontal');
		} else {
			classes.push('toolbar-vertical');
		}

		if (this._overflow) {
			classes.push('overflow');
		} else {
			classes.push('wrap');
		}
		return classes.join(' ');
	}

	private isHorizontal(): boolean {
		return this._orientation === Orientation.Horizontal;
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const overflowBackground = theme.getColor(EDITOR_PANE_BACKGROUND);
	if (overflowBackground) {
		collector.addRule(`modelview-toolbarcontainer .toolbar-overflow {
			background-color: ${overflowBackground};
		}`);
	}

	const overflowShadow = theme.getColor(TOOLBAR_OVERFLOW_SHADOW);
	if (overflowShadow) {
		collector.addRule(`modelview-toolbarcontainer .toolbar-overflow {
			box-shadow: 0px 4px 4px ${overflowShadow};
		}`);
	}

	const border = theme.getColor(DASHBOARD_BORDER);
	if (border) {
		collector.addRule(`modelview-toolbarcontainer .toolbar-overflow {
			border: 1px solid ${border};
		}`);
	}
});
