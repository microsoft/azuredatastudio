/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./radioButton';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit, ElementRef
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

@Component({
	selector: 'modelview-text',
	template: `
		<p [style.width]="getWidth()" [innerHTML]="getValue()"></p>`
})
export default class TextComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
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

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<sqlops.TextComponentProperties, string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<sqlops.TextComponentProperties, string>((props) => props.value, '');
	}

	public getValue(): string {
		let links = this.getPropertyOrDefault<sqlops.TextComponentProperties, sqlops.LinkArea[]>((props) => props.links, []);
		let originalText = this.value;
		if (links.length === 0) {
			return originalText;
		} else {
			let currentPosition = 0;
			links = links.sort((a, b) => a.startPosition - b.startPosition);
			let sections: string[] = [];
			for (let i: number = 0; i < links.length; i++) {
				let link = links[i];
				if (link.startPosition >= currentPosition && link.startPosition + link.length <= originalText.length) {
					sections.push(originalText.slice(currentPosition, link.startPosition));
					let linkTag = `<a href="${link.url}" tabIndex="0" target="blank">${originalText.slice(link.startPosition, link.startPosition + link.length)}</a>`;
					sections.push(linkTag);
					currentPosition = link.startPosition + link.length;
				}
			}

			if (currentPosition <= originalText.length - 1) {
				sections.push(originalText.slice(currentPosition));
			}

			return sections.join('');
		}
	}
}
