/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef
} from '@angular/core';

import * as azdata from 'azdata';

import { TitledComponent } from 'sql/workbench/browser/modelComponents/titledComponent';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { textLinkForeground, textLinkActiveForeground } from 'vs/platform/theme/common/colorRegistry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import * as DOM from 'vs/base/browser/dom';

@Component({
	selector: 'modelview-hyperlink',
	template: `<a [href]="url" [title]="title" [attr.aria-label]="ariaLabel" target="blank">{{label}}</a>`
})
export default class HyperlinkComponent extends TitledComponent implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IOpenerService) private openerService: IOpenerService
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		this._register(DOM.addDisposableListener(this._el.nativeElement, 'click', (e: MouseEvent) => this.onClick(e)));
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	public setLayout(layout: any): void {
		this.layout();
	}

	public set label(newValue: string) {
		this.setPropertyFromUI<azdata.HyperlinkComponentProperties, string>((properties, value) => { properties.label = value; }, newValue);
	}

	public get label(): string {
		return this.getPropertyOrDefault<azdata.HyperlinkComponentProperties, string>((props) => props.label, '');
	}

	public set url(newValue: string) {
		this.setPropertyFromUI<azdata.HyperlinkComponentProperties, string>((properties, value) => { properties.url = value; }, newValue);
	}

	public get url(): string {
		return this.getPropertyOrDefault<azdata.HyperlinkComponentProperties, string>((props) => props.url, '');
	}

	public onClick(e: MouseEvent): void {
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: undefined
		});
		if (this.url) {
			this.openerService.open(this.url);
		}
		DOM.EventHelper.stop(e, true);
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const linkForeground = theme.getColor(textLinkForeground);
	if (linkForeground) {
		collector.addRule(`
		modelview-hyperlink a:link,
		modelview-hyperlink a:visited {
			color: ${linkForeground};
		}
		`);
	}

	const activeForeground = theme.getColor(textLinkActiveForeground);
	if (activeForeground) {
		collector.addRule(`
		modelview-hyperlink a:hover {
			color: ${activeForeground};
		}
		`);
	}
});
