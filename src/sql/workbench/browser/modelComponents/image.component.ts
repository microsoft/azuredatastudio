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
import * as azdata from 'azdata';
import { ITitledComponent } from 'sql/workbench/browser/modelComponents/interfaces';
import { ComponentWithIconBase } from 'sql/workbench/browser/modelComponents/componentWithIconBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-image',
	template: `
		<div #imageContainer [ngStyle]="CSSStyles" [title]="title">`
})
export default class ImageComponent extends ComponentWithIconBase<azdata.ImageComponentProperties> implements ITitledComponent, IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('imageContainer', { read: ElementRef }) imageContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateIcon();
		this._changeRef.detectChanges();
	}

	protected override updateIcon() {
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

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'background-size': this.getImageSize(),
			'width': this.getWidth(),
			'height': this.getHeight()
		});
	}
}
