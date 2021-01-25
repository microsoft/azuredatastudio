/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef, ViewChild
} from '@angular/core';

import * as azdata from 'azdata';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { InfoBox, InfoBoxStyle } from 'sql/base/browser/ui/infoBox/infoBox';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachInfoBoxStyler } from 'sql/platform/theme/common/styler';

@Component({
	selector: 'modelview-infobox',
	template: `
		<div #container>
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
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
		if (this._container) {
			this._infoBox = new InfoBox(this._container.nativeElement);
			this._register(attachInfoBoxStyler(this._infoBox, this.themeService));
			this.updateInfoBox();
		}
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	public setLayout(layout: any): void {
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
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
}
