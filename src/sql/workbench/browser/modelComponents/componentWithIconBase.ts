/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChangeDetectorRef, ElementRef } from '@angular/core';
import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { createIconCssClass, IconPath } from 'sql/workbench/browser/modelComponents/iconUtils';
import { removeCSSRulesContainingSelector } from 'vs/base/browser/dom';
import { IComponentDescriptor } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';

export class ItemDescriptor<T> {
	constructor(public descriptor: IComponentDescriptor, public config: T) { }
}

export abstract class ComponentWithIconBase<T extends azdata.ComponentWithIconProperties> extends ComponentBase<T> {

	protected _iconClass: string;
	protected _iconPath: IconPath;
	constructor(
		changeRef: ChangeDetectorRef,
		el: ElementRef,
		logService: ILogService) {
		super(changeRef, el, logService);
	}

	/// IComponent implementation

	public get iconClass(): string {
		return this._iconClass + ' icon';
	}

	protected updateIcon() {
		if (this.iconPath && this.iconPath !== this._iconPath) {
			this._iconPath = this.iconPath;
			this._iconClass = createIconCssClass(this.iconPath, this._iconClass);
			this._changeRef.detectChanges();
		}
	}

	protected get defaultIconWidth(): number {
		return 50;
	}

	protected get defaultIconHeight(): number {
		return 50;
	}

	public getIconWidth(): string {
		return convertSize(this.iconWidth, `${this.defaultIconWidth}px`);
	}

	public getIconHeight(): string {
		return convertSize(this.iconHeight, `${this.defaultIconHeight}px`);
	}

	public get iconPath(): IconPath {
		return this.getPropertyOrDefault<IconPath>((props) => props.iconPath, undefined);
	}

	public get iconHeight(): number | string {
		return this.getPropertyOrDefault<number | string>((props) => props.iconHeight, this.defaultIconHeight);
	}

	public get iconWidth(): number | string {
		return this.getPropertyOrDefault<number | string>((props) => props.iconWidth, this.defaultIconWidth);
	}

	public get title(): string {
		return this.getPropertyOrDefault<string>((props) => props.title, '');
	}

	public set title(newTitle: string) {
		this.setPropertyFromUI<string>((properties, title) => { properties.title = title; }, newTitle);
	}

	ngOnDestroy(): void {
		if (this._iconClass) {
			removeCSSRulesContainingSelector(this._iconClass);
		}
		super.ngOnDestroy();
	}
}
