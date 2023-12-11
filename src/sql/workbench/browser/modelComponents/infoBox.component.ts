/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef, ViewChild
} from '@angular/core';

import * as azdata from 'azdata';
import { ComponentEventType, IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InfoBox, InfoBoxStyle } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { defaultInfoBoxStyles } from 'sql/platform/theme/browser/defaultStyles';

@Component({
	selector: 'modelview-infobox',
	template: `
		<div #container [ngStyle]="CSSStyles">
		</div>`
})
export default class InfoBoxComponent extends ComponentBase<azdata.InfoBoxComponentProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	private _infoBox: InfoBox;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
		if (this._container) {
			this._infoBox = this._instantiationService.createInstance(InfoBox, this._container.nativeElement, defaultInfoBoxStyles, undefined);
			this._infoBox.onDidClick(e => {
				this.fireEvent({
					eventType: ComponentEventType.onDidClick,
					args: e
				});
			});
			this._infoBox.onLinkClick(e => {
				this.fireEvent({
					eventType: ComponentEventType.onChildClick,
					args: e
				});
			});
			this.updateInfoBox();
		}
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	public setLayout(layout: any): void {
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateInfoBox();
	}

	private updateInfoBox(): void {
		if (this._infoBox) {
			this._container.nativeElement.style.width = this.getWidth();
			this._container.nativeElement.style.height = this.getHeight();
			this._infoBox.announceText = this.announceText;
			this._infoBox.infoBoxStyle = this.style;
			this._infoBox.text = this.text;
			this._infoBox.links = this.links;
			this._infoBox.isClickable = this.isClickable;
			this._infoBox.clickableButtonAriaLabel = this.clickableButtonAriaLabel;
		}
	}

	public get style(): InfoBoxStyle {
		return this.getPropertyOrDefault<InfoBoxStyle>((props) => props.style, 'information');
	}

	public get text(): string {
		return this.getPropertyOrDefault<string>((props) => props.text, '');
	}

	public get announceText(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.announceText, false);
	}

	public get isClickable(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.isClickable, false);
	}

	public get clickableButtonAriaLabel(): string {
		return this.getPropertyOrDefault<string>((props) => props.clickableButtonAriaLabel, '');
	}

	public get links(): azdata.LinkArea[] {
		return this.getPropertyOrDefault<azdata.LinkArea[]>((props) => props.links, []);
	}
}
