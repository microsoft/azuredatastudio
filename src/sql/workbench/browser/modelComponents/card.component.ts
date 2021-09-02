/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/legacycard';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy, ViewChild
} from '@angular/core';

import * as azdata from 'azdata';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

import { ComponentWithIconBase } from 'sql/workbench/browser/modelComponents/componentWithIconBase';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { CARD_OVERLAY_BACKGROUND, CARD_OVERLAY_FOREGROUND } from 'vs/workbench/common/theme';

export interface ActionDescriptor {
	label: string;
	actionTitle?: string;
	callbackData?: any;
}

export enum StatusIndicator {
	None = 0,
	Ok = 1,
	Warning = 2,
	Error = 3
}

export interface CardProperties {
	label: string;
	value?: string;
	actions?: ActionDescriptor[];
	descriptions?: CardDescriptionItem[];
	status?: StatusIndicator;
	selected?: boolean;
	cardType: CardType;
}

export interface CardDescriptionItem {
	label: string;
	value?: string;
}

export enum CardType {
	VerticalButton = 'VerticalButton',
	Details = 'Details',
	ListItem = 'ListItem',
	Image = 'Image'
}

@Component({
	templateUrl: decodeURI(require.toUrl('./card.component.html'))
})
export default class CardComponent extends ComponentWithIconBase<azdata.CardProperties> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private backgroundColor: string;

	@ViewChild('cardDiv', { read: ElementRef }) private cardDiv: ElementRef;
	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.onkeydown(this._el.nativeElement, (e: StandardKeyboardEvent) => {
			if (e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space) {
				this.onCardClick();
				DOM.EventHelper.stop(e, true);
			}
		});
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	override focus(): void {
		if (this.cardDiv) {
			this.cardDiv.nativeElement.focus();
		}
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
		let cardClass = this.isListItemCard ? 'model-card-list-item-legacy' : 'model-card-legacy';

		if (this.cardType === 'Image') {
			cardClass += ' image-card';
		}

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

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateIcon();
	}

	public override get iconClass(): string {
		if (this.isListItemCard) {
			return this._iconClass + ' icon' + ' list-item-icon';
		}
		else {
			return this._iconClass + ' icon' + ' cardIcon';
		}
	}

	private get selectable(): boolean {
		return this.enabled && (this.cardType === 'VerticalButton' || this.cardType === 'ListItem' || this.cardType === 'Image');
	}

	// CSS-bound properties

	public get label(): string {
		return this.getPropertyOrDefault<string>((props) => props.label, '');
	}

	public get value(): string {
		return this.getPropertyOrDefault<string>((props) => props.value, '');
	}

	public get cardType(): string {
		return this.getPropertyOrDefault<string>((props) => props.cardType, 'Details');
	}

	public get selected(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.selected, false);
	}

	public set selected(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.selected = value, newValue);
	}

	public get isDetailsCard(): boolean {
		return !this.cardType || this.cardType === 'Details';
	}

	public get isListItemCard(): boolean {
		return !this.cardType || this.cardType === 'ListItem';
	}

	public get isImageCard(): boolean {
		return !this.cardType || this.cardType === 'Image';
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

	public get descriptions(): CardDescriptionItem[] {
		return this.getPropertyOrDefault<CardDescriptionItem[]>((props) => props.descriptions, []);
	}

	public get actions(): ActionDescriptor[] {
		return this.getPropertyOrDefault<ActionDescriptor[]>((props) => props.actions, []);
	}

	public hasStatus(): boolean {
		let status = this.getPropertyOrDefault<StatusIndicator>((props) => props.status, StatusIndicator.None);
		return status !== StatusIndicator.None;
	}

	public get statusColor(): string {
		let status = this.getPropertyOrDefault<StatusIndicator>((props) => props.status, StatusIndicator.None);
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

	public onDidActionClick(action: ActionDescriptor): void {
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: action
		});

	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const backgroundColor = theme.getColor(CARD_OVERLAY_BACKGROUND);
	const foregroundColor = theme.getColor(CARD_OVERLAY_FOREGROUND);
	if (backgroundColor) {
		collector.addRule(`
		.model-card-legacy .card-label-overlay {
			background-color: ${backgroundColor.toString()};
		}
		`);
	}

	if (foregroundColor) {
		collector.addRule(`
		.model-card-legacy.image-card .card-label {
			color: ${foregroundColor.toString()};
		}
		`);
	}
});
