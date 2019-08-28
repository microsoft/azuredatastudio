/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/radioButton';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef, SecurityContext
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/workbench/browser/modelComponents/interfaces';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';

@Component({
	selector: 'modelview-text',
	template: `
		<p [style.width]="getWidth()" [innerHTML]="getValue()" [ngStyle]="this.CSSStyles" (click)="onClick()"></p>`
})
export default class TextComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => DomSanitizer)) private _domSanitizer: DomSanitizer) {
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

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<azdata.TextComponentProperties, string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<azdata.TextComponentProperties, string>((props) => props.value, '');
	}

	public getValue(): SafeHtml {
		let links = this.getPropertyOrDefault<azdata.TextComponentProperties, azdata.LinkArea[]>((props) => props.links, []);
		let text = this._domSanitizer.sanitize(SecurityContext.HTML, this.value);
		if (links.length !== 0) {
			for (let i: number = 0; i < links.length; i++) {
				let link = links[i];
				let linkTag = `<a href="${this._domSanitizer.sanitize(SecurityContext.URL, link.url)}" tabIndex="0" target="blank">${this._domSanitizer.sanitize(SecurityContext.HTML, link.text)}</a>`;
				text = text.replace(`{${i}}`, linkTag);
			}
		}
		return text;
	}

	private onClick() {
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: undefined
		});
	}
}
