/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { attachButtonStyler } from 'sql/common/theme/styler';
import { Button } from 'sql/base/browser/ui/button/button';

import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';

@Component({
	selector: 'button',
	template: `
		<div #input style="width: 100%"></div>
	`
})
export default class ButtonComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _button: Button;

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
				buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND
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
		this._button.label = this.label;
	}

	// CSS-bound properties

	private get label(): string {
		return this.getPropertyOrDefault<sqlops.ButtonProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<sqlops.ButtonProperties, string>(this.setValueProperties, newValue);
	}

	private setValueProperties(properties: sqlops.ButtonProperties, label: string): void {
		properties.label = label;
	}
}
