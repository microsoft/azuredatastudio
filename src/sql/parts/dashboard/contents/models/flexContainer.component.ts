/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/dashboard/contents/models/interfaces';
import { FlexContainerConfig, FlexItemConfig } from 'sqlops';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ComponentDescriptor } from './modelBuilder';
import { ModelContainerBase } from './modelComponentBase';
import { ModelComponentWrapper } from 'sql/parts/dashboard/contents/models/modelComponentWrapper.component';

class FlexItem {
	constructor(public descriptor: ComponentDescriptor, public flexConfig: FlexItemConfig) {}
}
@Component({
	template: `
		<div *ngIf="_components" class="flexContainer" [style.flexFlow]="flexFlow" [style.justifyContent]="justifyContent">
			<div *ngFor="let item of items" [style.flex]="item.config.flex" [style.order]="item.config.order" >
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})
export default class FlexContainer extends ModelContainerBase<FlexItemConfig> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _flexFlow: string;
	private _justifyContent: string;

	@ViewChildren(ModelComponentWrapper) private _componentWrappers: QueryList<ModelComponentWrapper>;

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) componentFactoryResolver: ComponentFactoryResolver,
		@Inject(forwardRef(() => ElementRef)) ref: ElementRef,
		@Inject(forwardRef(() => DashboardServiceInterface)) bootstrap: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => Injector)) injector: Injector
	) {
		super(componentFactoryResolver, ref, bootstrap, changeRef, injector);
		this._flexFlow = '';	// default
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

	public clearContainer(): void {
		if (this.componentHost && this.componentHost.viewContainerRef) {
			this.componentHost.viewContainerRef.clear();
		}
		this.items = [];

	}

	public setLayout (layout: FlexContainerConfig): void {
		this._flexFlow = layout.flexFlow ? layout.flexFlow : '';
		this._justifyContent= layout.justifyContent ? layout.justifyContent : '';
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		// Do nothing for now, no special properties supported
	}

	// CSS-bound properties
	public get flexFlow(): string {
		return this._flexFlow;
	}

	public get justifyContent(): string {
		return this._justifyContent;
	}
}
