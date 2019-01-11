/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./divContainer';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';
import * as sqlops from 'sqlops';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase } from 'sql/parts/modelComponents/componentBase';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';

import types = require('vs/base/common/types');

class DivItem {
	constructor(public descriptor: IComponentDescriptor, public config: sqlops.DivItemLayout) { }
}

@Component({
	template: `
		<div #divContainer *ngIf="items" class="divContainer" [style.height]="height" [style.width]="width">
			<div *ngFor="let item of items" [style.order]="getItemOrder(item)" [ngStyle]="getItemStyles(item)">
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})
export default class DivContainer extends ContainerBase<sqlops.DivItemLayout> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('divContainer', { read: ElementRef }) divContainer;
	private _height: string;
	private _width: string;
	private _overflowY: string;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
		this._overflowY = '';	// default
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}


	/// IComponent implementation

	public setLayout(layout: sqlops.DivLayout): void {
		this._height = this.convertSize(layout.height);
		this._width = this.convertSize(layout.width);
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.overflowY !== this._overflowY) {
			this.updateOverflowY();
		}
		this.updateScroll();
	}

	private updateOverflowY() {
		this._overflowY = this.overflowY;
		if (this._overflowY) {
			let element = <HTMLElement> this.divContainer.nativeElement;
			element.style.overflowY = this._overflowY;
		}
	}

	private updateScroll() {
		let element = <HTMLElement> this.divContainer.nativeElement;
		element.scrollTop = element.scrollTop - this.yOffsetChange;
		element.dispatchEvent(new Event('scroll'));
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
		return this.getPropertyOrDefault<sqlops.DivContainerProperties, any>((props) => props.overflowY, '');
	}
	public set overflowY(newValue: string) {
		this.setPropertyFromUI<sqlops.DivContainerProperties, any>((properties, newValue) => { properties.overflowY = newValue; }, newValue);
	}

	public get yOffsetChange(): number {
		return this.getPropertyOrDefault<sqlops.DivContainerProperties, any>((props) => props.yOffsetChange, 0);
	}
	public set yOffsetChange(newValue: number) {
		this.setPropertyFromUI<sqlops.DivContainerProperties, any>((properties, newValue) => { properties.yOffsetChange = newValue; }, newValue);
	}

	private getItemOrder(item: DivItem): number {
		return item.config ? item.config.order : 0;
	}
	private getItemStyles(item: DivItem): { [key: string]: string } {
		return item.config && item.config.CSSStyles ? item.config.CSSStyles : {};
	}
}
