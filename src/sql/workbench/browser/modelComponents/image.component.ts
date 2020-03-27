/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/image';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef, ViewChild
} from '@angular/core';

import * as DOM from 'vs/base/browser/dom';
import { ITitledComponent } from 'sql/workbench/browser/modelComponents/interfaces';
import { ComponentWithIconBase } from 'sql/workbench/browser/modelComponents/componentWithIconBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';

@Component({
	selector: 'modelview-image',
	template: `
		<div #imageContainer [title]="title" [style.width]="getWidth()" [style.height]="getHeight()" [style.background-size]="getImageSize()">`
})
export default class ImageComponent extends ComponentWithIconBase implements ITitledComponent, IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('imageContainer', { read: ElementRef }) imageContainer: ElementRef;

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

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateIcon();
		this._changeRef.detectChanges();
	}

	protected updateIcon() {
		if (this.iconPath) {
			if (!this._iconClass) {
				super.updateIcon();
				DOM.addClasses(this.imageContainer.nativeElement, this._iconClass, 'icon');
			} else {
				super.updateIcon();
			}
		}
	}

	/**
	 * Helper to get the size string for the background-size CSS property
	 */
	public getImageSize(): string {
		return `${this.getIconWidth()} ${this.getIconHeight()}`;
	}
}
