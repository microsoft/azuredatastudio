/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./groupLayout';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { GroupLayout, GroupItemLayout } from 'sqlops';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase } from 'sql/parts/modelComponents/componentBase';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

@Component({
	selector: 'modelview-groupContainer',
	template: `
		<div *ngIf="hasHeader()" [class]="getHeaderClass()" (click)="changeState()">
				{{_containerLayout.header}}
		</div>
		<div #container *ngIf="items" class="modelview-group-container" [style.width]="getContainerWidth()" [style.display]="getContainerDisplayStyle()">
			<ng-container *ngFor="let item of items">
			<div class="modelview-group-row" >
				<div  class="modelview-group-cell">
				<model-component-wrapper  [descriptor]="item.descriptor" [modelStore]="modelStore" >
				</model-component-wrapper>
				</div>
			</div>
			</ng-container>
		</div>
	`
})
export default class GroupContainer extends ContainerBase<GroupLayout> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _containerLayout: GroupLayout;
	private _collapsed: boolean;

	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
		this._collapsed = false;
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

	public setLayout(layout: GroupLayout): void {
		this._containerLayout = layout;
		this._collapsed = !!layout.collapsed;
		this.layout();
	}

	private hasHeader(): boolean {
		return this._containerLayout && this._containerLayout && this._containerLayout.header !== undefined;
	}

	private isCollapsible(): boolean {
		return this.hasHeader() && this._containerLayout.collapsible === true;
	}

	private getContainerWidth(): string {
		if (this._containerLayout && this._containerLayout.width) {
			let width: string = this._containerLayout.width.toString();
			if (!width.endsWith('%') && !width.toLowerCase().endsWith('px')) {
				width = width + 'px';
			}
			return width;
		} else {
			return '100%';
		}
	}

	private getContainerDisplayStyle(): string {
		return !this.isCollapsible() || !this._collapsed ? 'block' : 'none';
	}

	private getHeaderClass(): string {
		if (this.isCollapsible()) {
			let modifier = this._collapsed ? 'collapsed' : 'expanded';
			return `modelview-group-header-collapsible ${modifier}`;
		} else {
			return 'modelview-group-header';
		}
	}

	private changeState(): void {
		if (this.isCollapsible()) {
			this._collapsed = !this._collapsed;
			this._changeRef.detectChanges();
		}
	}
}
