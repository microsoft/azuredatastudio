/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';
import { FlexLayout, FlexItemLayout } from 'sqlops';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase, ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import { Event, Emitter } from 'vs/base/common/event';

import { SplitView, Orientation, Sizing, IView } from 'vs/base/browser/ui/splitview/splitview';
import { ScrollableSplitView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import * as DOM from 'vs/base/browser/dom';
import types = require('vs/base/common/types');


class SplitPane implements IView {
	element: HTMLElement;
	minimumSize: number;
	maximumSize: number;
	onDidChange: Event<number> = Event.None;
	size: number;
	layout(size: number): void {
		this.size = size;
	}
}
class FlexItem {
	constructor(public descriptor: IComponentDescriptor, public config: FlexItemLayout) { }
}

@Component({
	template: `
		<div *ngIf="items" class="flexContainer" [style.flexFlow]="flexFlow" [style.justifyContent]="justifyContent" [style.position]="position"
				[style.alignItems]="alignItems" [style.alignContent]="alignContent" [style.height]="height" [style.width]="width">
			<div *ngFor="let item of items" [style.flex]="getItemFlex(item)" [style.textAlign]="textAlign" [style.order]="getItemOrder(item)" [ngStyle]="getItemStyles(item)">
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})
export default class SplitViewContainer extends ContainerBase<FlexItemLayout> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _flexFlow: string;
	private _justifyContent: string;
	private _alignItems: string;
	private _alignContent: string;
	private _textAlign: string;
	private _height: string;
	private _width: string;
	private _position: string;
	private _splitView: SplitView;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
		this._flexFlow = '';	// default
		this._justifyContent = '';	// default
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	ngAfterViewInit(): void {
		this._splitView = this._register(new SplitView(this._el.nativeElement, { orientation: Orientation.VERTICAL }));
	}


	private GetCorrespondingView(component: IComponent): IView {
		let c = component as ComponentBase;
		// TODO : Find what variables (not static values) to use here
		let basicView: SplitPane = new SplitPane();
		basicView.element = c.getHtml(),
		basicView.minimumSize = 300;
		basicView.maximumSize = Number.MAX_VALUE;
		basicView.layout(500);
		return basicView;
	}


	/// IComponent implementation

	public setLayout(layout: FlexLayout): void {
		this._flexFlow = layout.flexFlow ? layout.flexFlow : '';
		this._justifyContent = layout.justifyContent ? layout.justifyContent : '';
		this._alignItems = layout.alignItems ? layout.alignItems : '';
		this._alignContent = layout.alignContent ? layout.alignContent : '';
		this._textAlign = layout.textAlign ? layout.textAlign : '';
		this._position = layout.position ? layout.position : '';
		this._height = this.convertSize(layout.height);
		this._width = this.convertSize(layout.width);


		if (this._componentWrappers) {
			this._componentWrappers.forEach(item => {
				var component = item.modelStore.getComponent(item.descriptor.id);
				let view = this.GetCorrespondingView(component);
				this._splitView.addView(view, Sizing.Distribute);
			});
		}
		this._splitView.layout(this._el.nativeElement.size);

	}


	// CSS-bound properties
	public get flexFlow(): string {
		return this._flexFlow;
	}

	public get justifyContent(): string {
		return this._justifyContent;
	}

	public get alignItems(): string {
		return this._alignItems;
	}

	public get height(): string {
		return this._height;
	}

	public get width(): string {
		return this._width;
	}

	public get alignContent(): string {
		return this._alignContent;
	}

	public get textAlign(): string {
		return this._textAlign;
	}

	public get position(): string {
		return this._position;
	}

	private getItemFlex(item: FlexItem): string {
		return item.config ? item.config.flex : '1 1 auto';
	}
	private getItemOrder(item: FlexItem): number {
		return item.config ? item.config.order : 0;
	}
	private getItemStyles(item: FlexItem): { [key: string]: string } {
		return item.config && item.config.CSSStyles ? item.config.CSSStyles : {};
	}
}
