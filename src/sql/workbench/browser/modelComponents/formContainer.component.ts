/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/formLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import { FormLayout, FormItemLayout } from 'azdata';

import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { find } from 'vs/base/common/arrays';
import { IComponentDescriptor, IComponent, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';

export interface TitledFormItemLayout {
	title: string;
	actions?: string[];
	isFormComponent: boolean;
	horizontal: boolean;
	componentWidth?: number | string;
	componentHeight?: number | string;
	titleFontSize?: number | string;
	required?: boolean;
	info?: string;
	isInGroup?: boolean;
	isGroupLabel?: boolean;
}

class FormItem {
	constructor(public descriptor: IComponentDescriptor, public config: TitledFormItemLayout) { }
}

@Component({
	template: `
		<div #container *ngIf="items" class="form-table" [style.padding]="getFormPadding()" [style.width]="getFormWidth()" [style.height]="getFormHeight()" role="presentation">
			<ng-container *ngFor="let item of items">
			<div class="form-row" *ngIf="isGroupLabel(item)" [style.font-size]="getItemTitleFontSize(item)">
				<div class="form-item-row form-group-label">
					<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
					</model-component-wrapper>
				</div>
			</div>
			<div class="form-row" *ngIf="isFormComponent(item)" [style.height]="getRowHeight(item)">
					<ng-container *ngIf="isHorizontal(item)">
						<div *ngIf="hasItemTitle(item)" class="form-cell form-cell-title" [style.font-size]="getItemTitleFontSize(item)" [ngClass]="{'form-group-item': isInGroup(item)}">
							{{getItemTitle(item)}}<span class="form-required" *ngIf="isItemRequired(item)">*</span>
							<span class="codicon help form-info" *ngIf="itemHasInfo(item)" [title]="getItemInfo(item)"></span>
						</div>
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
					<div class="form-vertical-container" *ngIf="isVertical(item)" [style.height]="getRowHeight(item)" [ngClass]="{'form-group-item': isInGroup(item)}">
						<div class="form-item-row" [style.font-size]="getItemTitleFontSize(item)">
							{{getItemTitle(item)}}<span class="form-required" *ngIf="isItemRequired(item)">*</span>
							<span class="codicon help form-info" *ngIf="itemHasInfo(item)" [title]="getItemInfo(item)"></span>
						</div>
						<div class="form-item-row" [style.width]="getComponentWidth(item)" [style.height]="getRowHeight(item)">
							<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore" [style.width]="getComponentWidth(item)" [style.height]="getRowHeight(item)">
							</model-component-wrapper>
						</div>
						<div *ngIf="itemHasActions(item)" class="form-item-row form-actions-table form-item-last-row">
								<div *ngFor="let actionItem of getActionComponents(item)" class="form-actions-cell" >
									<model-component-wrapper  [descriptor]="actionItem.descriptor" [modelStore]="modelStore">
									</model-component-wrapper>
								</div>
							</div>
					</div>
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

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	ngAfterViewInit(): void {
	}

	public layout(): void {
		super.layout();
	}

	/// IComponent implementation

	public get alignItems(): string {
		return this._alignItems;
	}

	public get alignContent(): string {
		return this._alignContent;
	}

	public getFormWidth(): string {
		return convertSize(this._formLayout && this._formLayout.width, '');
	}

	public getFormPadding(): string {
		return this._formLayout && this._formLayout.padding ? this._formLayout.padding : '10px 30px 0px 30px';
	}

	public getFormHeight(): string {
		return convertSize(this._formLayout && this._formLayout.height, '');
	}

	public getComponentWidth(item: FormItem): string {
		let itemConfig = item.config;
		return (itemConfig && itemConfig.componentWidth) ? convertSize(itemConfig.componentWidth, '') : '';
	}

	public getRowHeight(item: FormItem): string {
		let itemConfig = item.config;
		return (itemConfig && itemConfig.componentHeight) ? convertSize(itemConfig.componentHeight, '') : '';
	}

	public isItemRequired(item: FormItem): boolean {
		let itemConfig = item.config;
		return itemConfig && itemConfig.required;
	}

	public getItemInfo(item: FormItem): string {
		let itemConfig = item.config;
		return itemConfig && itemConfig.info;
	}

	public itemHasInfo(item: FormItem): boolean {
		let itemConfig = item.config;
		return itemConfig && itemConfig.info !== undefined;
	}


	private getItemTitle(item: FormItem): string {
		let itemConfig = item.config;
		return itemConfig ? itemConfig.title : '';
	}

	public hasItemTitle(item: FormItem): boolean {
		return this.getItemTitle(item) !== '';
	}

	public getItemTitleFontSize(item: FormItem): string {
		let defaultFontSize = '14px';
		if (this.isInGroup(item)) {
			defaultFontSize = '12px';
		}
		let itemConfig = item.config;
		return itemConfig && itemConfig.titleFontSize ? convertSize(itemConfig.titleFontSize, defaultFontSize) : defaultFontSize;
	}

	public getActionComponents(item: FormItem): FormItem[] {
		let items = this.items;
		let itemConfig = item.config;
		if (itemConfig && itemConfig.actions) {
			let resultItems = itemConfig.actions.map(x => {
				let actionComponent = find(items, i => i.descriptor.id === x);
				return <FormItem>actionComponent;
			});

			return resultItems.filter(r => r && r.descriptor);
		}

		return [];
	}

	public isGroupLabel(item: FormItem): boolean {
		return item && item.config && item.config.isGroupLabel;
	}

	private isInGroup(item: FormItem): boolean {
		return item && item.config && item.config.isInGroup;
	}

	public isFormComponent(item: FormItem): boolean {
		return item && item.config && item.config.isFormComponent;
	}

	public itemHasActions(item: FormItem): boolean {
		let itemConfig = item.config;
		return itemConfig && itemConfig.actions !== undefined && itemConfig.actions.length > 0;
	}

	public setLayout(layout: FormLayout): void {
		this._formLayout = layout;
		this.layout();
	}

	public isHorizontal(item: FormItem): boolean {
		return item && item.config && item.config.horizontal;
	}

	public isVertical(item: FormItem): boolean {
		return item && item.config && !item.config.horizontal;
	}
}
