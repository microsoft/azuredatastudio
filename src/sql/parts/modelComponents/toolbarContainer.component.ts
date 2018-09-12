/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./toolbarLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import { Orientation, ToolbarLayout } from 'sql/workbench/api/common/sqlExtHostTypes';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';

import { ContainerBase } from 'sql/parts/modelComponents/componentBase';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

export interface ToolbarItemConfig {
	title?: string;
}

export class ToolbarItem {
	constructor(public descriptor: IComponentDescriptor, public config: ToolbarItemConfig) { }
}

@Component({
	selector: 'modelview-toolbarContainer',
	template: `
		<div #container *ngIf="items" [class]="toolbarClass" >
			<ng-container *ngFor="let item of items">
			<div class="modelview-toolbar-item" [style.paddingTop]="paddingTop">
				<div *ngIf="shouldShowTitle(item)" class="modelview-toolbar-title" >
					{{getItemTitle(item)}}
				</div>
				<div class="modelview-toolbar-component">
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

	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	private _orientation: Orientation;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
		this._orientation = Orientation.Horizontal;
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

	public setLayout(layout: ToolbarLayout): void {
		this._orientation = layout.orientation ? layout.orientation : Orientation.Horizontal;
		this.layout();
	}

	public getItemTitle(item: ToolbarItem): string {
		let itemConfig = item.config;
		return itemConfig ? itemConfig.title : '';
	}

	public shouldShowTitle(item: ToolbarItem): boolean {
		return this.hasTitle(item) && this.isHorizontal();
	}

	private hasTitle(item: ToolbarItem): boolean {
		return item && item.config && item.config.title !== undefined;
	}

	public get paddingTop(): string {
		return this.isHorizontal() ? '' : '';
	}

	public get toolbarClass(): string {
		let classes = ['modelview-toolbar-container'];
		if (this.isHorizontal()) {
			classes.push('toolbar-horizontal');
		} else {
			classes.push('toolbar-vertical');
		}
		return classes.join(' ');
	}

	private isHorizontal(): boolean {
		return this._orientation === Orientation.Horizontal;
	}
}
