/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/workbench/browser/modelComponents/interfaces';

@Component({
	selector: 'modelview-image',
	template: `
		<img [style.width]="getWidth()" [style.height]="getHeight()" [src]="src" [alt]="alt">`
})
export default class ImageComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		this.layout();
	}

	public set src(newValue: string) {
		this.setPropertyFromUI<azdata.ImageComponentProperties, string>((properties, value) => { properties.src = value; }, newValue);
	}

	public get src(): string {
		return this.getPropertyOrDefault<azdata.ImageComponentProperties, string>((props) => props.src, '');
	}

	public set alt(newValue: string) {
		this.setPropertyFromUI<azdata.ImageComponentProperties, string>((properties, value) => { properties.alt = value; }, newValue);
	}

	public get alt(): string {
		return this.getPropertyOrDefault<azdata.ImageComponentProperties, string>((props) => props.alt, '');
	}
}
