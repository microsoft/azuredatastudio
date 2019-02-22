/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./dom';
import 'vs/css!./highlight';
import 'vs/css!./markdown';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList
} from '@angular/core';

import * as sqlops from 'sqlops';
import * as DOM from 'vs/base/browser/dom';
import { $, Builder } from 'sql/base/browser/builder';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';

@Component({
	template: '',
	selector: 'modelview-dom-component'
})
export default class DomComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _renderedHtml: string;
	private _rootElement: Builder;
	private _bodyElement: Builder;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
		this.createDomElement();
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.layout();
		}));
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	private createDomElement() {
		this._rootElement = new Builder(this._el.nativeElement);
		this._bodyElement = $('.dom-body');
		this._rootElement.append(this._bodyElement);
	}

	/// Dom Functions
	private setHtml(): void {
		if (this.html) {
			this._renderedHtml = this.html;
			this._bodyElement.innerHtml(this._renderedHtml);
		}
	}

	/// IComponent implementation
	public layout(): void {
		super.layout();
		let element = <HTMLElement>this._el.nativeElement;
		element.style.width = this.getWidth();
		element.style.height = this.getHeight();
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.html !== this._renderedHtml) {
			this.setHtml();
		}
	}

	// CSS-bound properties
	public get html(): string {
		return this.getPropertyOrDefault<sqlops.DomProperties, string>((props) => props.html, '');
	}

	public set html(newValue: string) {
		this.setPropertyFromUI<sqlops.DomProperties, string>((properties, html) => { properties.html = html; }, newValue);
	}
}
