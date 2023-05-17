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
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { errorForeground } from 'vs/platform/theme/common/colorRegistry';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { RequiredIndicatorClassName } from 'sql/base/browser/ui/label/label';

export enum TextType {
	Normal = 'Normal',
	Error = 'Error',
	UnorderedList = 'UnorderedList',
	OrderedList = 'OrderedList'
}

const errorTextClass = 'error-text';

@Component({
	selector: 'modelview-text',
	template: `
	<div *ngIf="showList;else noList" [style.display]="display" [style.width]="getWidth()" [style.height]="getHeight()" [title]="title" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden" [ngStyle]="this.CSSStyles" [attr.aria-live]="ariaLive">
		<div *ngIf="isUnOrderedList;else orderedlist">
			<ul style="padding-left:0px">
				<li *ngFor="let v of value">{{v}}</li>
			</ul>
		</div>
		<ng-template #orderedlist>
			<ol style="padding-left:0px">
				<li *ngFor="let v of value">{{v}}</li>
			</ol>
		</ng-template>
	</div>
	<ng-template #noList>
		<div *ngIf="showDiv;else noDiv" style="display:flex;flex-flow:row;align-items:center;" [style.width]="getWidth()" [style.height]="getHeight()">
			<p [title]="title" [ngStyle]="this.CSSStyles" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden" [attr.aria-live]="ariaLive"></p>
			<div #textContainer id="textContainer"></div>
			<div *ngIf="description" tabindex="0" class="modelview-text-tooltip" [attr.aria-label]="description" role="img" (mouseenter)="showTooltip($event)" (focus)="showTooltip($event)" (keydown)="onDescriptionKeyDown($event)">
				<div class="modelview-text-tooltip-content" [innerHTML]="description"></div>
			</div>
		</div>
		<ng-template #noDiv>
			<div #textContainer id="textContainer" [style.display]="display" [style.width]="getWidth()" [style.height]="getHeight()" [title]="title" [attr.role]="ariaRole" [attr.aria-hidden]="ariaHidden" [attr.aria-live]="ariaLive" [ngStyle]="this.CSSStyles"></div>
		</ng-template>
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
		@Inject(ILogService) logService: ILogService) {
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

	public set value(newValue: string | string[]) {
		this.setPropertyFromUI<string | string[]>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string | string[] {
		return this.getPropertyOrDefault<string | string[]>((props) => props.value, undefined);
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

	public get textType(): azdata.TextType | undefined {
		let textType = this.getPropertyOrDefault<azdata.TextType | undefined>(props => props.textType, undefined);
		if (!textType && typeof this.value !== 'string') {
			textType = (this.value) ? TextType.UnorderedList : undefined;
		}
		// Throwing an error when a string value is provided for list.
		if ((textType === TextType.OrderedList || textType === TextType.UnorderedList) && typeof this.value === 'string') {
			throw new Error(`Invalid type of value provided for the textType ${textType}`);
		}
		return textType;
	}

	public set textType(newValue: azdata.TextType | undefined) {
		this.setPropertyFromUI<azdata.TextType | undefined>((properties, value) => { properties.textType = value; }, newValue);
	}

	public get isUnOrderedList(): boolean | undefined {
		return this.textType === TextType.UnorderedList;
	}

	public get showList(): boolean | undefined {
		return (this.textType === TextType.UnorderedList || this.textType === TextType.OrderedList);
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.updateText();
		if (this.textType === TextType.Error) {
			(this._el.nativeElement as HTMLElement).classList.add(errorTextClass);
		} else {
			(this._el.nativeElement as HTMLElement).classList.remove(errorTextClass);
		}
		this._changeRef.detectChanges();
	}

	public updateText(): void {
		if (typeof this.value !== 'string') {
			return;
		}
		const textContainerElement = <HTMLElement>this.textContainer.nativeElement;
		DOM.clearNode((textContainerElement));
		if (this.requiredIndicator) {
			textContainerElement.classList.add(RequiredIndicatorClassName);
		} else {
			textContainerElement.classList.remove(RequiredIndicatorClassName);
		}
		const links = this.getPropertyOrDefault<azdata.LinkArea[]>((props) => props.links, []);
		// The text may contain link placeholders so go through and create those and insert them as needed now
		let text = this.value;
		for (let i: number = 0; i < links.length; i++) {
			const placeholderIndex = text.indexOf(`{${i}}`);
			if (placeholderIndex < 0) {
				this.logService.warn(`Could not find placeholder text {${i}} in text '${this.value}'. Link: ${JSON.stringify(links[i])}`);
				// Just continue on so we at least show the rest of the text if just one was missed or something
				continue;
			}

			// First insert any text from the start of the current string fragment up to the placeholder
			let curText = text.slice(0, placeholderIndex);
			if (curText && typeof text === 'string') {
				const textElement = this.createTextElement();
				textElement.innerText = text.slice(0, placeholderIndex);
				textContainerElement.appendChild(textElement);
			}

			// Now insert the link element
			const link = links[i];
			const linkElement = this._register(this.instantiationService.createInstance(Link,
				textContainerElement, {
				label: link.text,
				href: link.url
			}, undefined));

			if (link.accessibilityInformation) {
				linkElement.el.setAttribute('aria-label', link.accessibilityInformation.label);
				if (link.accessibilityInformation.role) {
					linkElement.el.setAttribute('role', link.accessibilityInformation.role);
				}
			}

			textContainerElement.appendChild(linkElement.el);

			// And finally update the text to remove the text up through the placeholder we just added
			text = text.slice(placeholderIndex + 3);
		}

		// If we have any text left over now insert that in directly
		if (text && typeof text === 'string') {
			const textElement = this.createTextElement();
			textElement.innerText = text;
			textContainerElement.appendChild(textElement);
		}
	}

	public get showDiv(): boolean {
		return this.requiredIndicator || !!this.description;
	}

	public get ariaLive(): string | undefined {
		return this.getPropertyOrDefault<string | undefined>((props) => props.ariaLive, undefined);
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

	public showTooltip(e: Event): void {
		const descriptionDiv = <HTMLElement>e.target;
		const tooltip = <HTMLElement>(descriptionDiv.querySelector('.modelview-text-tooltip-content'));
		tooltip.style.display = '';
	}

	public onDescriptionKeyDown(e: Event): void {
		if (e instanceof KeyboardEvent) {
			let event = new StandardKeyboardEvent(e);
			const descriptionDiv = <HTMLElement>e.target;
			const tooltip = <HTMLElement>(descriptionDiv.querySelector('.modelview-text-tooltip-content'));
			if (event.equals(KeyCode.Escape)) {
				tooltip.style.display = 'none';
				event.stopPropagation();
				event.preventDefault();
			} else if (event.equals(KeyCode.Enter)) {
				tooltip.style.display = '';
				event.stopPropagation();
				event.preventDefault();
			}
		}
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const errorForegroundColor = theme.getColor(errorForeground);
	if (errorForegroundColor) {
		collector.addRule(`
		modelview-text.${errorTextClass} {
			color: ${errorForegroundColor};
		}
		`);
	}
});
