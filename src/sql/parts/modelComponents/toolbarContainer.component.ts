/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./toolbarLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase } from 'sql/parts/modelComponents/componentBase';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

export interface ToolbarItemConfig {
	title?: string;
}

class ToolbarItem {
	constructor(public descriptor: IComponentDescriptor, public config: ToolbarItemConfig) { }
}

@Component({
	selector: 'modelview-toolbarContainer',
	template: `
		<div #container *ngIf="items" class="modelview-toolbar-container">
			<ng-container *ngFor="let item of items">
			<div class="modelview-toolbar-item" >
				<div *ngIf="hasTitle(item)" class="modelview-toolbar-title" >
					{{getItemTitle(item)}}
				</div>
				<div  class="modelview-toolbar-component">
					<model-component-wrapper  [descriptor]="item.descriptor" [modelStore]="modelStore" >
					</model-component-wrapper>
				</div>
			</div>
			</ng-container>
		</div>
	`
})
export default class ToolbarContainer extends ContainerBase<ToolbarItemConfig> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChildren(ModelComponentWrapper) private _componentWrappers: QueryList<ModelComponentWrapper>;
	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	ngAfterViewInit(): void {
	}

	/// IComponent implementation

	public layout(): void {
		if (this._componentWrappers) {
			this._componentWrappers.forEach(wrapper => {
				wrapper.layout();
			});
		}
	}

	public setLayout(layout: any): void {
		this.layout();
	}

	private getItemTitle(item: ToolbarItem): string {
		let itemConfig = item.config;
		return itemConfig ? itemConfig.title : '';
	}

	private hasTitle(item: ToolbarItem): boolean {
		return item && item.config && item.config.title !== undefined;
	}
}
