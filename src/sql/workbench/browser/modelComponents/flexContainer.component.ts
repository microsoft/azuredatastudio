/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/flexContainer';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ElementRef, OnDestroy
} from '@angular/core';

import { FlexLayout, FlexItemLayout } from 'azdata';

import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponentDescriptor, IComponent, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';

export class FlexItem {
	constructor(public descriptor: IComponentDescriptor, public config: FlexItemLayout) { }
}

@Component({
	template: `
		<div *ngIf="items" class="flexContainer" [ngStyle]="CSSStyles" [style.display]="display" [style.flexFlow]="flexFlow" [style.justifyContent]="justifyContent" [style.position]="position"
				[style.alignItems]="alignItems" [style.alignContent]="alignContent" [style.height]="height" [style.width]="width" [style.flex-wrap]="flexWrap" [attr.role]="ariaRole">
			<div *ngFor="let item of items" [style.flex]="getItemFlex(item)" [style.textAlign]="textAlign" [style.order]="getItemOrder(item)" [ngStyle]="getItemStyles(item)">
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})
export default class FlexContainer extends ContainerBase<FlexItemLayout> implements IComponent, OnDestroy {
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
	private _flexWrap: string;

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


	/// IComponent implementation

	public setLayout(layout: FlexLayout): void {
		this._flexFlow = layout.flexFlow ? layout.flexFlow : '';
		this._justifyContent = layout.justifyContent ? layout.justifyContent : '';
		this._alignItems = layout.alignItems ? layout.alignItems : '';
		this._alignContent = layout.alignContent ? layout.alignContent : '';
		this._textAlign = layout.textAlign ? layout.textAlign : '';
		this._position = layout.position ? layout.position : '';
		this._height = convertSize(layout.height);
		this._width = convertSize(layout.width);
		this._flexWrap = layout.flexWrap ? layout.flexWrap : '';

		this.layout();
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

	public get flexWrap(): string {
		return this._flexWrap;
	}

	public getItemFlex(item: FlexItem): string {
		return item.config ? item.config.flex : '1 1 auto';
	}
	public getItemOrder(item: FlexItem): number {
		return item.config ? item.config.order : 0;
	}
	public getItemStyles(item: FlexItem): { [key: string]: string } {
		return item.config && item.config.CSSStyles ? item.config.CSSStyles : {};
	}
}
