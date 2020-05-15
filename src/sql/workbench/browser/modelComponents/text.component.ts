/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/text';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef, ViewChild
} from '@angular/core';

import * as azdata from 'azdata';

import { TitledComponent } from 'sql/workbench/browser/modelComponents/titledComponent';
import { IComponentDescriptor, IComponent, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { Link } from 'vs/platform/opener/browser/link';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { attachLinkStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

@Component({
	selector: 'modelview-text',
	template: `
	<div *ngIf="showDiv;else noDiv" style="display:flex;flex-flow:row;align-items:center;" [style.width]="getWidth()" [style.height]="getHeight()">
	<p [title]="title" [ngStyle]="this.CSSStyles" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden"></p>
		<span #textContainer></span>
		<p *ngIf="requiredIndicator" style="color:red;margin-left:5px;">*</p>
		<div *ngIf="description" tabindex="0" class="modelview-text-tooltip" [attr.aria-label]="description" role="img">
			<div class="modelview-text-tooltip-content" [innerHTML]="description"></div>
		</div>
	</div>
	<ng-template #noDiv>
	<p [style.display]="display" [style.width]="getWidth()" [style.height]="getHeight()" [title]="title" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden" [ngStyle]="this.CSSStyles">
		<span #textContainer></span>
	</p>
	</ng-template>`
})
export default class TextComponent extends TitledComponent implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('textContainer', { read: ElementRef }) textContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(ILogService) private logService: ILogService,
		@Inject(IThemeService) private themeService: IThemeService) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		this.updateText();
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

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateText();
		this._changeRef.detectChanges();
	}

	public updateText(): void {
		DOM.clearNode((<HTMLElement>this.textContainer.nativeElement));
		const links = this.getPropertyOrDefault<azdata.TextComponentProperties, azdata.LinkArea[]>((props) => props.links, []);
		// The text may contain link placeholders so go through and create those and insert them as needed now
		let text = this.value;
		for (let i: number = 0; i < links.length; i++) {
			const placeholderIndex = text.indexOf(`{${i}}`);
			if (placeholderIndex < 0) {
				this.logService.warn(`Could not find placeholder text {${i}} in text ${this.value}`);
				// Just continue on so we at least show the rest of the text if just one was missed or something
				continue;
			}

			// First insert any text from the start of the current string fragment up to the placeholder
			let curText = text.slice(0, placeholderIndex);
			if (curText) {
				const textSpan = DOM.$('span');
				textSpan.innerText = text.slice(0, placeholderIndex);
				(<HTMLElement>this.textContainer.nativeElement).appendChild(textSpan);
			}

			// Now insert the link element
			const link = links[i];
			const linkElement = this._register(this.instantiationService.createInstance(Link, {
				label: link.text,
				href: link.url
			}));
			this._register(attachLinkStyler(linkElement, this.themeService));
			(<HTMLElement>this.textContainer.nativeElement).appendChild(linkElement.el);

			// And finally update the text to remove the text up through the placeholder we just added
			text = text.slice(placeholderIndex + 3);
		}

		// If we have any text left over now insert that in directly
		if (text) {
			const textSpan = DOM.$('span');
			textSpan.innerText = text;
			(<HTMLElement>this.textContainer.nativeElement).appendChild(textSpan);
		}
	}

	public get showDiv(): boolean {
		return this.requiredIndicator || !!this.description;
	}
}
