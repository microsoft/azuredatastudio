/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./card';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ComponentWithIconBase } from 'sql/parts/modelComponents/componentWithIconBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { StatusIndicator, CardProperties, ActionDescriptor } from 'sql/workbench/api/common/sqlExtHostTypes';

@Component({
	templateUrl: decodeURI(require.toUrl('sql/parts/modelComponents/card.component.html'))
})
export default class CardComponent extends ComponentWithIconBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private backgroundColor: string;

	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());

	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	private _defaultBorderColor = 'rgb(214, 214, 214)';
	private _hasFocus: boolean;

	public onCardClick() {
		if (this.selectable) {
			this.selected = !this.selected;
			this._changeRef.detectChanges();
			this.fireEvent({
				eventType: ComponentEventType.onDidClick,
				args: this.selected
			});
		}
	}

	public getBorderColor() {
		if (this.selectable && this.selected || this._hasFocus) {
			return 'Blue';
		} else {
			return this._defaultBorderColor;
		}
	}

	public getClass(): string {
		let cardClass = this.isListItemCard ? 'model-card-list-item' : 'model-card';
		return (this.selectable && this.selected || this._hasFocus) ? `${cardClass} selected` :
			`${cardClass} unselected`;
	}

	public onCardHoverChanged(event: any) {
		if (this.selectable) {
			this._hasFocus = event.type === 'mouseover';
			this._changeRef.detectChanges();
		}
	}
	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateIcon();
	}

	public get iconClass(): string {
		if (this.isListItemCard) {
			return this._iconClass + ' icon' + ' list-item-icon';
		}
		else {
			return this._iconClass + ' icon' + ' cardIcon';
		}
	}

	private get selectable(): boolean {
		return this.cardType === 'VerticalButton' || this.cardType === 'ListItem';
	}

	// CSS-bound properties

	public get label(): string {
		return this.getPropertyOrDefault<CardProperties, string>((props) => props.label, '');
	}

	public get value(): string {
		return this.getPropertyOrDefault<CardProperties, string>((props) => props.value, '');
	}

	public get cardType(): string {
		return this.getPropertyOrDefault<CardProperties, string>((props) => props.cardType, 'Details');
	}

	public get selected(): boolean {
		return this.getPropertyOrDefault<sqlops.CardProperties, boolean>((props) => props.selected, false);
	}

	public set selected(newValue: boolean) {
		this.setPropertyFromUI<sqlops.CardProperties, boolean>((props, value) => props.selected = value, newValue);
	}

	public get isDetailsCard(): boolean {
		return !this.cardType || this.cardType === 'Details';
	}

	public get isListItemCard(): boolean {
		return !this.cardType || this.cardType === 'ListItem';
	}

	public get isVerticalButton(): boolean {
		return this.cardType === 'VerticalButton';
	}

	public get showRadioButton(): boolean {
		return this.selectable && (this.selected || this._hasFocus);
	}

	public get showAsSelected(): boolean {
		return this.selectable && this.selected;
	}

	public get descriptions(): string[] {
		return this.getPropertyOrDefault<CardProperties, string[]>((props) => props.descriptions, []);
	}

	public get actions(): ActionDescriptor[] {
		return this.getPropertyOrDefault<CardProperties, ActionDescriptor[]>((props) => props.actions, []);
	}

	public hasStatus(): boolean {
		let status = this.getPropertyOrDefault<CardProperties, StatusIndicator>((props) => props.status, StatusIndicator.None);
		return status !== StatusIndicator.None;
	}

	public get statusColor(): string {
		let status = this.getPropertyOrDefault<CardProperties, StatusIndicator>((props) => props.status, StatusIndicator.None);
		switch (status) {
			case StatusIndicator.Ok:
				return 'green';
			case StatusIndicator.Warning:
				return 'orange';
			case StatusIndicator.Error:
				return 'red';
			default:
				return this.backgroundColor;
		}
	}

	private updateTheme(theme: IColorTheme) {
		this.backgroundColor = theme.getColor(colors.editorBackground, true).toString();
		this._changeRef.detectChanges();
	}

	private onDidActionClick(action: ActionDescriptor): void {
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: action
		});

	}
}
