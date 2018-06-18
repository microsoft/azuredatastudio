/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./button';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { attachButtonStyler } from 'sql/common/theme/styler';
import { Button } from 'sql/base/browser/ui/button/button';

import { SIDE_BAR_BACKGROUND, SIDE_BAR_TITLE_FOREGROUND } from 'vs/workbench/common/theme';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import URI from 'vs/base/common/uri';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { createCSSRule, removeCSSRulesContainingSelector } from 'vs/base/browser/dom';
import { focusBorder, foreground } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';

type IUserFriendlyIcon = string | URI | { light: string | URI; dark: string | URI };

@Component({
	selector: 'modelview-button',
	template: `
		<div #input style="width: 100%"></div>
	`
})
export default class ButtonComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _button: Button;
	private _iconClass: string;
	private _iconPath: IUserFriendlyIcon;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super(changeRef);

	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this._button = new Button(this._inputContainer.nativeElement);

			this._register(this._button);
			this._register(attachButtonStyler(this._button, this.themeService, {
				buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND, buttonForeground: SIDE_BAR_TITLE_FOREGROUND
			}));
			this._register(this._button.onDidClick(e => {
				this._onEventEmitter.fire({
					eventType: ComponentEventType.onDidClick,
					args: e
				});
			}));
		}
	}

	ngOnDestroy(): void {
		if (this._iconClass) {
			removeCSSRulesContainingSelector(this._iconClass);
		}
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._button.enabled = this.enabled;
		this._button.label = this.label;
		if (this.width) {
			this._button.setWidth(this.width.toString());
		}
		if (this.height) {
			this._button.setWidth(this.height.toString());
		}
		this.updateIcon();
	}

	private updateIcon() {
		if (this.iconPath && this.iconPath !== this._iconPath) {
			this._iconPath = this.iconPath;
			if (!this._iconClass) {
				const ids = new IdGenerator('button-component-icon-' + Math.round(Math.random() * 1000));
				this._iconClass = ids.nextId();
				this._button.icon = this._iconClass + ' icon';

				// Styling for icon button
				this._register(attachButtonStyler(this._button, this.themeService, {
					buttonBackground: Color.transparent.toString(),
					buttonHoverBackground: Color.transparent.toString(),
					buttonFocusOutline: focusBorder,
					buttonForeground: foreground
				}));
			}

			removeCSSRulesContainingSelector(this._iconClass);
			const icon = this.getLightIconPath(this.iconPath);
			const iconDark = this.getDarkIconPath(this.iconPath) || icon;
			createCSSRule(`.icon.${this._iconClass}`, `background-image: url("${icon}")`);
			createCSSRule(`.vs-dark .icon.${this._iconClass}, .hc-black .icon.${this._iconClass}`, `background-image: url("${iconDark}")`);
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

	// CSS-bound properties

	private get label(): string {
		return this.getPropertyOrDefault<sqlops.ButtonProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<sqlops.ButtonProperties, string>(this.setValueProperties, newValue);
	}

	public get iconPath(): string | URI | { light: string | URI; dark: string | URI } {
		return this.getPropertyOrDefault<sqlops.ButtonProperties, IUserFriendlyIcon>((props) => props.iconPath, undefined);
	}

	public set iconPath(newValue: string | URI | { light: string | URI; dark: string | URI }) {
		this.setPropertyFromUI<sqlops.ButtonProperties, IUserFriendlyIcon>((properties, iconPath) => { properties.iconPath = iconPath; }, newValue);
	}

	private setValueProperties(properties: sqlops.ButtonProperties, label: string): void {
		properties.label = label;
	}
}
