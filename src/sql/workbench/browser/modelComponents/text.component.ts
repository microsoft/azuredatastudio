/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/text';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef, SecurityContext
} from '@angular/core';

import * as azdata from 'azdata';

import { SafeHtml, DomSanitizer } from '@angular/platform-browser';
import { TitledComponent } from 'sql/workbench/browser/modelComponents/titledComponent';
import { IComponentDescriptor, IComponent, IModelStore } from 'sql/platform/dashboard/browser/interfaces';

@Component({
	selector: 'modelview-text',
	template: `
	<div *ngIf="showDiv;else noDiv" style="display:flex;flex-flow:row;align-items:center;" [style.width]="getWidth()" [style.height]="getHeight()">
	<p [innerHTML]="getValue()" [title]="title" [ngStyle]="this.CSSStyles" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden"></p>
		<p  *ngIf="requiredIndicator" style="color:red;margin-left:5px;">*</p>
		<div *ngIf="description" tabindex="0" class="modelview-text-tooltip" [attr.aria-label]="description" role="img">
			<div class="modelview-text-tooltip-content" [innerHTML]="description"></div>
		</div>
	</div>
	<ng-template #noDiv>
	<p [innerHTML]="getValue()" [style.display]="display" [style.width]="getWidth()" [style.height]="getHeight()" [title]="title" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden" [ngStyle]="this.CSSStyles"></p>
	</ng-template>`
})
export default class TextComponent extends TitledComponent implements IComponent, OnDestroy, AfterViewInit {
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

	public set description(newValue: string) {
		this.setPropertyFromUI<azdata.TextComponentProperties, string>((properties, value) => { properties.description = value; }, newValue);
	}

	public get description(): string {
		return this.getPropertyOrDefault<azdata.TextComponentProperties, string>((props) => props.description, '');
	}

	public set requiredIndicator(newValue: boolean) {
		this.setPropertyFromUI<azdata.TextComponentProperties, boolean>((properties, value) => { properties.requiredIndicator = value; }, newValue);
	}

	public get requiredIndicator(): boolean {
		return this.getPropertyOrDefault<azdata.TextComponentProperties, boolean>((props) => props.requiredIndicator, false);
	}

	public getValue(): SafeHtml {
		let links = this.getPropertyOrDefault<azdata.TextComponentProperties, azdata.LinkArea[]>((props) => props.links, []);
		let text = this._domSanitizer.sanitize(SecurityContext.HTML, this.value);
		if (links.length !== 0) {
			for (let i: number = 0; i < links.length; i++) {
				let link = links[i];
				let linkTag = `<a class="modelview-text-link" href="${this._domSanitizer.sanitize(SecurityContext.URL, link.url)}" tabIndex="0" target="blank">${this._domSanitizer.sanitize(SecurityContext.HTML, link.text)}</a>`;
				text = text.replace(`{${i}}`, linkTag);
			}
		}
		return text;
	}

	public get showDiv(): boolean {
		return this.requiredIndicator || !!this.description;
	}
}
