/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ElementRef, Injector, OnDestroy, OnInit
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/dashboard/contents/models/interfaces';
import { FlexContainerConfig, FlexItemConfig } from 'sqlops';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ComponentDescriptor } from './modelBuilder';

export class ItemDescriptor<T> {
	constructor(public descriptor: ComponentDescriptor, public config: T) {}

}

export abstract class ModelContainerBase<T> implements IComponent, OnDestroy, OnInit {
	protected items: ItemDescriptor<T>[];

	@ViewChild(ComponentHostDirective) componentHost: ComponentHostDirective;

	constructor(
		protected _componentFactoryResolver: ComponentFactoryResolver,
		protected _ref: ElementRef,
		protected _bootstrap: DashboardServiceInterface,
		protected _changeRef: ChangeDetectorRef,
		protected _injector: Injector) {

		this.items = [];
	}

	/// IComponent implementation

	abstract descriptor: IComponentDescriptor;
	abstract modelStore: IModelStore;

	public layout(): void {

		this._changeRef.detectChanges();
	}

	protected baseInit(): void {
		if (this.modelStore) {
			this.modelStore.registerComponent(this);
		}
	}

	abstract ngOnInit(): void;

	protected baseDestroy(): void {
		if (this.modelStore) {
			this.modelStore.unregisterComponent(this);
		}
	}

	abstract ngOnDestroy(): void;

	public clearContainer(): void {
		if (this.componentHost && this.componentHost.viewContainerRef) {
			this.componentHost.viewContainerRef.clear();
		}
		this.items = [];

	}

	public addToContainer(componentDescriptor: IComponentDescriptor, config: any): void {
		this.items.push(new ItemDescriptor(componentDescriptor, config));
	}

	abstract setLayout (layout: FlexContainerConfig): void;

	abstract setProperties(properties: { [key: string]: any; }): void;

}
