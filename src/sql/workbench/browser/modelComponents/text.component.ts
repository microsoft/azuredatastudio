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
		<div #textContainer id="textContainer"></div>
		<span *ngIf="requiredIndicator" style="color:red;margin-left:5px;">*</span>
		<div *ngIf="description" tabindex="0" class="modelview-text-tooltip" [attr.aria-label]="description" role="img">
			<div class="modelview-text-tooltip-content" [innerHTML]="description"></div>
		</div>
	</div>
	<ng-template #noDiv>
		<div #textContainer id="textContainer" [style.display]="display" [style.width]="getWidth()" [style.height]="getHeight()" [title]="title" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden" [ngStyle]="this.CSSStyles"></div>
	</ng-template>`
})
export default class TextComponent extends TitledComponent<azdata.TextComponentProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('textContainer', { read: ElementRef }) textContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(ILogService) logService: ILogService,
		@Inject(IThemeService) private themeService: IThemeService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.updateText();
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<string>((props) => props.value, '');
	}

	public set description(newValue: string) {
		this.setPropertyFromUI<string>((properties, value) => { properties.description = value; }, newValue);
	}

	public get description(): string {
		return this.getPropertyOrDefault<string>((props) => props.description, '');
	}

	public set requiredIndicator(newValue: boolean) {
		this.setPropertyFromUI<boolean>((properties, value) => { properties.requiredIndicator = value; }, newValue);
	}

	public get requiredIndicator(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.requiredIndicator, false);
	}

	public get headingLevel(): azdata.HeadingLevel | undefined {
		return this.getPropertyOrDefault<azdata.HeadingLevel | undefined>(props => props.headingLevel, undefined);
	}

	public set headingLevel(newValue: azdata.HeadingLevel | undefined) {
		this.setPropertyFromUI<azdata.HeadingLevel | undefined>((properties, value) => { properties.headingLevel = value; }, newValue);
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateText();
		this._changeRef.detectChanges();
	}

	public updateText(): void {
		DOM.clearNode((<HTMLElement>this.textContainer.nativeElement));
		const links = this.getPropertyOrDefault<azdata.LinkArea[]>((props) => props.links, []);
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
				const textElement = this.createTextElement();
				textElement.innerText = text.slice(0, placeholderIndex);
				(<HTMLElement>this.textContainer.nativeElement).appendChild(textElement);
			}

			// Now insert the link element
			const link = links[i];
			const linkElement = this._register(this.instantiationService.createInstance(Link, {
				label: link.text,
				href: link.url
			}));
			if (link.accessibilityInformation) {
				linkElement.el.setAttribute('aria-label', link.accessibilityInformation.label);
				if (link.accessibilityInformation.role) {
					linkElement.el.setAttribute('role', link.accessibilityInformation.role);
				}
			}

			this._register(attachLinkStyler(linkElement, this.themeService));
			(<HTMLElement>this.textContainer.nativeElement).appendChild(linkElement.el);

			// And finally update the text to remove the text up through the placeholder we just added
			text = text.slice(placeholderIndex + 3);
		}

		// If we have any text left over now insert that in directly
		if (text) {
			const textElement = this.createTextElement();
			textElement.innerText = text;
			(<HTMLElement>this.textContainer.nativeElement).appendChild(textElement);
		}
	}

	public get showDiv(): boolean {
		return this.requiredIndicator || !!this.description;
	}

	/**
	 * Creates the appropriate text element based on the type of text component (regular or header) this is
	 * @returns The text element
	 */
	private createTextElement(): HTMLElement {
		let headingLevel = this.headingLevel;
		let element: HTMLElement;
		if (!headingLevel) { // Undefined or 0
			element = DOM.$('span');
		} else {
			element = DOM.$(`h${headingLevel}`);
		}
		// Manually set the font-size and font-weight since that is set by the base style sheets which may not be what the user wants
		element.style.fontSize = this.CSSStyles['font-size']?.toString();
		element.style.fontWeight = this.CSSStyles['font-weight']?.toString();
		return element;
	}
}
