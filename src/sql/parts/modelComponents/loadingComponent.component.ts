/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./loadingComponent';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, OnDestroy, AfterViewInit, ElementRef
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';
import * as nls from 'vs/nls';

@Component({
	selector: 'modelview-loadingComponent',
	template: `
		<div class="modelview-loadingComponent-container" *ngIf="loading">
			<div class="modelview-loadingComponent-spinner" *ngIf="loading" [title]=_loadingTitle #spinnerElement></div>
		</div>
		<model-component-wrapper #childElement [descriptor]="_component" [modelStore]="modelStore" *ngIf="_component" [ngClass]="{'modelview-loadingComponent-content-loading': loading}">
		</model-component-wrapper>
	`
})
export default class LoadingComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	private readonly _loadingTitle = nls.localize('loadingMessage', 'Loading');
	private _component: IComponentDescriptor;

	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
		this._validations.push(() => {
			if (!this._component) {
				return true;
			}
			return this.modelStore.getComponent(this._component.id).validate();
		});
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		this.setLayout();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(): void {
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
	}

	public get loading(): boolean {
		return this.getPropertyOrDefault<sqlops.LoadingComponentProperties, boolean>((props) => props.loading, false);
	}

	public set loading(newValue: boolean) {
		this.setPropertyFromUI<sqlops.LoadingComponentProperties, boolean>((properties, value) => { properties.loading = value; }, newValue);
		this.layout();
	}

	public addToContainer(componentDescriptor: IComponentDescriptor): void {
		this._component = componentDescriptor;
		this.layout();
	}
}
