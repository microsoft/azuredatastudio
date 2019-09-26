/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChangeDetectorRef, ElementRef } from '@angular/core';

import { IComponentDescriptor } from 'sql/workbench/browser/modelComponents/interfaces';
import * as azdata from 'azdata';
import { URI } from 'vs/base/common/uri';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { createCSSRule, removeCSSRulesContainingSelector, asCSSUrl } from 'vs/base/browser/dom';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';


export type IUserFriendlyIcon = string | URI | { light: string | URI; dark: string | URI };

export class ItemDescriptor<T> {
	constructor(public descriptor: IComponentDescriptor, public config: T) { }
}

const ids = new IdGenerator('model-view-component-icon-');

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
			if (!this._iconClass) {
				this._iconClass = ids.nextId();
			}

			removeCSSRulesContainingSelector(this._iconClass);
			const icon = this.getLightIconUri(this.iconPath);
			const iconDark = this.getDarkIconUri(this.iconPath) || icon;
			createCSSRule(`.icon.${this._iconClass}`, `background-image: ${asCSSUrl(icon)}`);
			createCSSRule(`.vs-dark .icon.${this._iconClass}, .hc-black .icon.${this._iconClass}`, `background-image: ${asCSSUrl(iconDark)}`);
			this._changeRef.detectChanges();
		}
	}

	private getLightIconUri(iconPath: IUserFriendlyIcon): URI {
		if (iconPath && iconPath['light']) {
			return this.getIconUri(iconPath['light']);
		} else {
			return this.getIconUri(<string | URI>iconPath);
		}
	}

	private getDarkIconUri(iconPath: IUserFriendlyIcon): URI {
		if (iconPath && iconPath['dark']) {
			return this.getIconUri(iconPath['dark']);
		}
		return null;
	}

	private getIconUri(iconPath: string | URI): URI {
		if (typeof iconPath === 'string') {
			return URI.file(iconPath);
		} else {
			return URI.revive(iconPath);
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
