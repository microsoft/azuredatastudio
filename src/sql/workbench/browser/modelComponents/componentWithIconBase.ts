/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChangeDetectorRef, ElementRef } from '@angular/core';

import { IComponentDescriptor } from 'sql/workbench/browser/modelComponents/interfaces';
import * as azdata from 'azdata';
import { URI } from 'vs/base/common/uri';
import { removeCSSRulesContainingSelector } from 'vs/base/browser/dom';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IUserFriendlyIcon, getIconClass } from 'sql/workbench/browser/modelComponents/iconUtils';

export class ItemDescriptor<T> {
	constructor(public descriptor: IComponentDescriptor, public config: T) { }
}

export abstract class ComponentWithIconBase extends ComponentBase {

	protected _iconClass: string;
	protected _iconPath: IUserFriendlyIcon;
	constructor(
		changeRef: ChangeDetectorRef,
		el: ElementRef, ) {
		super(changeRef, el);
	}

	/// IComponent implementation

	public get iconClass(): string {
		return this._iconClass + ' icon';
	}

	protected updateIcon() {
		if (this.iconPath && this.iconPath !== this._iconPath) {
			this._iconPath = this.iconPath;
			this._iconClass = getIconClass(this.iconPath, this._iconClass);
			this._changeRef.detectChanges();
		}
	}

	public getIconWidth(): string {
		return this.convertSize(this.iconWidth, '40px');
	}

	public getIconHeight(): string {
		return this.convertSize(this.iconHeight, '40px');
	}

	public get iconPath(): string | URI | { light: string | URI; dark: string | URI } {
		return this.getPropertyOrDefault<azdata.ComponentWithIcon, IUserFriendlyIcon>((props) => props.iconPath, undefined);
	}

	public get iconHeight(): number | string {
		return this.getPropertyOrDefault<azdata.ComponentWithIcon, number | string>((props) => props.iconHeight, '50px');
	}

	public get iconWidth(): number | string {
		return this.getPropertyOrDefault<azdata.ComponentWithIcon, number | string>((props) => props.iconWidth, '50px');
	}

	ngOnDestroy(): void {
		if (this._iconClass) {
			removeCSSRulesContainingSelector(this._iconClass);
		}
		super.ngOnDestroy();
	}
}
