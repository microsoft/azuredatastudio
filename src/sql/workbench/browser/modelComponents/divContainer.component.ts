/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/divContainer';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, Renderer2, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';

import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IComponentDescriptor, IComponent, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';

class DivItem {
	constructor(public descriptor: IComponentDescriptor, public config: azdata.DivItemLayout) { }
}

@Component({
	template: `
		<div #divContainer *ngIf="items" class="divContainer" [ngStyle]="CSSStyles" [style.height]="height" [style.width]="width" [style.display]="display" (keyup)="onKey($event)" [attr.role]="ariaRole" [attr.aria-selected]="ariaSelected">
			<div *ngFor="let item of items" [style.order]="getItemOrder(item)" [ngStyle]="getItemStyles(item)">
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})
export default class DivContainer extends ContainerBase<azdata.DivItemLayout> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('divContainer', { read: ElementRef }) divContainer;
	private _height: string;
	private _width: string;
	private _overflowY: string;
	private viewInitialized: boolean;
	private cancelClick: Function;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => Renderer2)) private renderer: Renderer2
	) {
		super(changeRef, el);
		this._overflowY = '';	// default
	}

	ngAfterViewInit() {
		this.viewInitialized = true;
		this.updateClickListener();
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}


	/// IComponent implementation

	public setLayout(layout: azdata.DivLayout): void {
		this._height = convertSize(layout.height);
		this._width = convertSize(layout.width);
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.overflowY !== this._overflowY) {
			this.updateOverflowY();
		}
		this.updateScroll();
		this.updateClickable();
	}

	private updateOverflowY() {
		this._overflowY = this.overflowY;
		if (this._overflowY) {
			let element = <HTMLElement>this.divContainer.nativeElement;
			element.style.overflowY = this._overflowY;
		}
	}

	private updateScroll() {
		let element = <HTMLElement>this.divContainer.nativeElement;
		element.scrollTop = element.scrollTop - this.yOffsetChange;
		element.dispatchEvent(new Event('scroll'));
	}

	private updateClickable(): void {
		const element = <HTMLElement>this.divContainer.nativeElement;
		if (this.clickable) {
			element.tabIndex = 0;
			element.style.cursor = 'pointer';
		} else {
			element.removeAttribute('tabIndex');
			element.style.cursor = 'default';
		}
		this.updateClickListener();
	}

	private onClick() {
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: undefined
		});
	}

	// CSS-bound properties
	public get height(): string {
		return this._height;
	}

	public get width(): string {
		return this._width;
	}

	// CSS-bound properties
	public get overflowY(): string {
		return this.getPropertyOrDefault<azdata.DivContainerProperties, any>((props) => props.overflowY, '');
	}
	public set overflowY(newValue: string) {
		this.setPropertyFromUI<azdata.DivContainerProperties, any>((properties, newValue) => { properties.overflowY = newValue; }, newValue);
	}

	public get yOffsetChange(): number {
		return this.getPropertyOrDefault<azdata.DivContainerProperties, any>((props) => props.yOffsetChange, 0);
	}
	public set yOffsetChange(newValue: number) {
		this.setPropertyFromUI<azdata.DivContainerProperties, any>((properties, newValue) => { properties.yOffsetChange = newValue; }, newValue);
	}

	public get clickable(): boolean {
		return this.getPropertyOrDefault<azdata.DivContainerProperties, boolean>((props) => props.clickable, false);
	}

	public onKey(e: KeyboardEvent) {
		let event = new StandardKeyboardEvent(e);
		if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
			this.onClick();
			e.stopPropagation();
		}
	}

	public getItemOrder(item: DivItem): number {
		return item.config ? item.config.order : 0;
	}
	public getItemStyles(item: DivItem): { [key: string]: string } {
		return item.config && item.config.CSSStyles ? item.config.CSSStyles : {};
	}

	private updateClickListener(): void {
		// We can't hook into the listener until the view is initialized
		if (!this.viewInitialized) {
			return;
		}
		if (this.clickable && !this.cancelClick) {
			this.cancelClick = this.renderer.listen(this.divContainer.nativeElement, 'click', () => this.onClick());
		} else if (!this.clickable && this.cancelClick) {
			this.cancelClick();
			this.cancelClick = undefined;
		}
	}
}
