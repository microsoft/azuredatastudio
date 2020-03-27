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

@Component({
	selector: 'modelview-hyperlink',
	template: `<a [href]="getUrl()" [title]="title" [attr.aria-label]="ariaLabel" target="blank" (click)="onClick()">{{getLabel()}}</a>`
})
export default class HyperlinkComponent extends TitledComponent implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
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

	public getLabel(): string {
		return this.label;
	}

	public set url(newValue: string) {
		this.setPropertyFromUI<azdata.HyperlinkComponentProperties, string>((properties, value) => { properties.url = value; }, newValue);
	}

	public get url(): string {
		return this.getPropertyOrDefault<azdata.HyperlinkComponentProperties, string>((props) => props.url, '');
	}

	public getUrl(): string {
		return this.url;
	}

	public onClick(): boolean {
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: undefined
		});
		// If we don't have a URL then return false since that just defaults to the URL for the workbench. We assume
		// if a blank url is specified then the caller is handling the click themselves.
		return !!this.url;
	}
}
