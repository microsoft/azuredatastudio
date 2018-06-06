/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./formLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { FormLayout, FormItemLayout } from 'sqlops';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase } from 'sql/parts/modelComponents/componentBase';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

export interface TitledFormItemLayout {
	title: string;
	actions?: string[];
	isFormComponent: Boolean;
	horizontal: boolean;
	componentWidth: number;
}

export interface FormLayout {
	width: number;
}

class FormItem {
	constructor(public descriptor: IComponentDescriptor, public config: TitledFormItemLayout) { }
}

@Component({
	template: `
		<div #container *ngIf="items" class="form-table" [style.width]="getFormWidth()">
			<ng-container *ngFor="let item of items">
			<div class="form-row" >
				<ng-container *ngIf="isFormComponent(item)">
					<ng-container *ngIf="isHorizontal(item)">
						<div class="form-cell">{{getItemTitle(item)}}</div>
						<div class="form-cell">
							<div class="form-component-container">
								<div [style.width]="getComponentWidth(item)" [ngClass]="{'form-input-flex': !getComponentWidth(item)}">
									<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
									</model-component-wrapper>
								</div>
								<div *ngIf="itemHasActions(item)" class="form-component-actions">
										<ng-container *ngFor="let actionItem of getActionComponents(item)">
											<model-component-wrapper  [descriptor]="actionItem.descriptor" [modelStore]="modelStore" >
											</model-component-wrapper>
										</ng-container>
								</div>
							</div>
						</div>
					</ng-container>
					<div class="form-vertical-container" *ngIf="isVertical(item)">
						<div class="form-item-row">{{getItemTitle(item)}}</div>
						<div class="form-item-row" [style.width]="getComponentWidth(item)">
							<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore" [style.width]="getComponentWidth(item)">
							</model-component-wrapper>
						</div>
						<div *ngIf="itemHasActions(item)" class="form-item-row form-actions-table form-item-last-row">
								<div *ngFor="let actionItem of getActionComponents(item)" class="form-actions-cell" >
									<model-component-wrapper  [descriptor]="actionItem.descriptor" [modelStore]="modelStore">
									</model-component-wrapper>
								</div>
							</div>
					</div>
				</ng-container>
			</div>
			</ng-container>
		</div>
	`
})
export default class FormContainer extends ContainerBase<FormItemLayout> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _alignItems: string;
	private _alignContent: string;
	private _formLayout: FormLayout;

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

	public get alignItems(): string {
		return this._alignItems;
	}

	public get alignContent(): string {
		return this._alignContent;
	}

	private getFormWidth(): string {
		return this._formLayout && this._formLayout.width ? +this._formLayout.width + 'px' : '100%';
	}

	private getComponentWidth(item: FormItem): string {
		let itemConfig = item.config;
		return (itemConfig && itemConfig.componentWidth) ? itemConfig.componentWidth + 'px' : '';
	}

	private getItemTitle(item: FormItem): string {
		let itemConfig = item.config;
		return itemConfig ? itemConfig.title : '';
	}

	private getActionComponents(item: FormItem): FormItem[] {
		let items = this.items;
		let itemConfig = item.config;
		if (itemConfig && itemConfig.actions) {
			let resultItems = itemConfig.actions.map(x => {
				let actionComponent = items.find(i => i.descriptor.id === x);
				return <FormItem>actionComponent;
			});

			return resultItems.filter(r => r && r.descriptor);
		}

		return [];
	}

	private isFormComponent(item: FormItem): Boolean {
		return item && item.config && item.config.isFormComponent;
	}

	private itemHasActions(item: FormItem): Boolean {
		let itemConfig = item.config;
		return itemConfig && itemConfig.actions !== undefined && itemConfig.actions.length > 0;
	}

	public setLayout(layout: FormLayout): void {
		this._formLayout = layout;
		this.layout();
	}

	private isHorizontal(item: FormItem): boolean {
		return item && item.config && item.config.horizontal;
	}

	private isVertical(item: FormItem): boolean {
		return item && item.config && !item.config.horizontal;
	}
}
