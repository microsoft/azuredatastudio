/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/dom';
import 'vs/css!./media/highlight';
import 'vs/css!./media/markdown';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy
} from '@angular/core';

import * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';

@Component({
	template: '',
	selector: 'modelview-dom-component'
})
export default class DomComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _renderedHtml: string;
	private _rootElement: HTMLElement;
	private _bodyElement: HTMLElement;

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
		this._rootElement = this._el.nativeElement;
		this._bodyElement = DOM.$('.dom-body');
		this._rootElement.append(this._bodyElement);
	}

	/// Dom Functions
	private setHtml(): void {
		if (this.html) {
			this._renderedHtml = this.html;
			this._bodyElement.innerHTML = this._renderedHtml;
		}
	}

	/// IComponent implementation
	public layout(): void {
		super.layout();
		const element = <HTMLElement>this._el.nativeElement;
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
		return this.getPropertyOrDefault<azdata.DomProperties, string>((props) => props.html, '');
	}

	public set html(newValue: string) {
		this.setPropertyFromUI<azdata.DomProperties, string>((properties, html) => { properties.html = html; }, newValue);
	}
}
