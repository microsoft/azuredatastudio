/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, OnInit, QueryList, AfterViewInit
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore, IComponentEventArgs, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import * as sqlops from 'sqlops';
import { URI } from 'vs/base/common/uri';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { createCSSRule, removeCSSRulesContainingSelector } from 'vs/base/browser/dom';
import { ComponentBase } from 'sql/parts/modelComponents/componentBase';


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
			const icon = this.getLightIconPath(this.iconPath);
			const iconDark = this.getDarkIconPath(this.iconPath) || icon;
			createCSSRule(`.icon.${this._iconClass}`, `background-image: url("${icon}")`);
			createCSSRule(`.vs-dark .icon.${this._iconClass}, .hc-black .icon.${this._iconClass}`, `background-image: url("${iconDark}")`);
			this._changeRef.detectChanges();
		}
	}

	private getLightIconPath(iconPath: IUserFriendlyIcon): string {
		if (iconPath && iconPath['light']) {
			return this.getIconPath(iconPath['light']);
		} else {
			return this.getIconPath(<string | URI>iconPath);
		}
	}

	private getDarkIconPath(iconPath: IUserFriendlyIcon): string {
		if (iconPath && iconPath['dark']) {
			return this.getIconPath(iconPath['dark']);
		}
		return null;
	}

	private getIconPath(iconPath: string | URI): string {
		if (typeof iconPath === 'string') {
			return URI.file(iconPath).toString();
		} else {
			let uri = URI.revive(iconPath);
			return uri.toString();
		}
	}

	public getIconWidth(): string {
		return this.convertSize(this.iconWidth, '40px');
	}

	public getIconHeight(): string {
		return this.convertSize(this.iconHeight, '40px');
	}

	public get iconPath(): string | URI | { light: string | URI; dark: string | URI } {
		return this.getPropertyOrDefault<sqlops.ComponentWithIcon, IUserFriendlyIcon>((props) => props.iconPath, undefined);
	}

	public get iconHeight(): number | string {
		return this.getPropertyOrDefault<sqlops.ComponentWithIcon, number | string>((props) => props.iconHeight, '50px');
	}

	public get iconWidth(): number | string {
		return this.getPropertyOrDefault<sqlops.ComponentWithIcon, number | string>((props) => props.iconWidth, '50px');
	}

	ngOnDestroy(): void {
		if (this._iconClass) {
			removeCSSRulesContainingSelector(this._iconClass);
		}
		super.ngOnDestroy();
	}
}
