/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./formLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';
import { FormLayout, FormItemLayout } from 'sqlops';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase } from 'sql/parts/modelComponents/componentBase';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';

class FormItem {
	constructor(public descriptor: IComponentDescriptor, public config: FormItemLayout) { }
}

@Component({
	template: `
		<div *ngIf="items" class="model-table"
				[style.alignItems]="alignItems" [style.alignContent]="alignContent">
			<div *ngFor="let item of items" class="model-row">
				<div class="model-cell">{{getItemTitle(item)}}</div>
				<div class="model-cell">
					<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
					</model-component-wrapper>
				</div>
			</div>
		</div>
	`
})
export default class FormContainer extends ContainerBase<FormItemLayout> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _justifyContent: string;
	private _alignItems: string;
	private _alignContent: string;

	@ViewChildren(ModelComponentWrapper) private _componentWrappers: QueryList<ModelComponentWrapper>;

	constructor( @Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
		this._justifyContent = '';	// default
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}


	/// IComponent implementation

	public layout(): void {
		if (this._componentWrappers) {
			this._componentWrappers.forEach(wrapper => {
				wrapper.layout();
			});
		}
	}

	public get justifyContent(): string {
		return this._justifyContent;
	}

	public get alignItems(): string {
		return this._alignItems;
	}

	public get alignContent(): string {
		return this._alignContent;
	}

	private getItemTitle(item: FormItem): string {

		let component = this.modelStore.getComponent(item.descriptor.id);
		return component ? component.title : '';
	}

	public setLayout(layout: any): void {
		this.layout();
	}
}
