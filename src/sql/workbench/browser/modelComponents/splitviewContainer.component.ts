/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/flexContainer';

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy } from '@angular/core';

import { FlexItemLayout, SplitViewLayout } from 'azdata';
import { FlexItem } from './flexContainer.component';
import { ContainerBase, ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { Event } from 'vs/base/common/event';
import { SplitView, Orientation, Sizing, IView } from 'vs/base/browser/ui/splitview/splitview';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { convertSize, convertSizeToNumber } from 'sql/base/browser/dom';

class SplitPane implements IView {
	orientation: Orientation;
	element: HTMLElement;
	minimumSize: number;
	maximumSize: number;
	onDidChange: Event<number> = Event.None;
	size: number;
	component: ComponentBase;
	layout(size: number): void {
		this.size = size;
		try {
			if (this.orientation === Orientation.VERTICAL) {
				this.component.updateProperty('height', size);
			}
			else {
				this.component.updateProperty('width', size);
			}
		} catch { }
	}
}

@Component({
	template: `
		<div *ngIf="items" class="splitViewContainer" [style.flexFlow]="flexFlow" [style.justifyContent]="justifyContent" [style.position]="position"
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
	private _orientation: Orientation;
	private _splitViewHeight: number;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) private readonly logService: ILogService
	) {
		super(changeRef, el);
		this._flexFlow = '';	// default
		this._justifyContent = '';	// default
		this._orientation = Orientation.VERTICAL; // default
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	ngAfterViewInit(): void {
		this._splitView = this._register(new SplitView(this._el.nativeElement, { orientation: this._orientation }));
	}

	private GetCorrespondingView(component: IComponent, orientation: Orientation): IView {
		let c = component as ComponentBase;
		let basicView: SplitPane = new SplitPane();
		basicView.orientation = orientation;
		basicView.element = c.getHtml();
		basicView.component = c;
		basicView.minimumSize = 50;
		basicView.maximumSize = Number.MAX_VALUE;
		return basicView;
	}

	/// IComponent implementation

	public setLayout(layout: SplitViewLayout): void {
		this._flexFlow = layout.flexFlow ? layout.flexFlow : '';
		this._justifyContent = layout.justifyContent ? layout.justifyContent : '';
		this._alignItems = layout.alignItems ? layout.alignItems : '';
		this._alignContent = layout.alignContent ? layout.alignContent : '';
		this._textAlign = layout.textAlign ? layout.textAlign : '';
		this._position = layout.position ? layout.position : '';
		this._height = convertSize(layout.height);
		this._width = convertSize(layout.width);
		this._orientation = layout.orientation.toLowerCase() === 'vertical' ? Orientation.VERTICAL : Orientation.HORIZONTAL;
		this._splitViewHeight = convertSizeToNumber(layout.splitViewHeight);

		if (this._componentWrappers) {
			this._componentWrappers.forEach(item => {
				let component = item.modelStore.getComponent(item.descriptor.id);
				item.modelStore.validate(component).then(value => {
					if (value === true) {
						let view = this.GetCorrespondingView(component, this._orientation);
						this._splitView.addView(view, Sizing.Distribute);
					}
					else {
						this.logService.warn('Could not add views inside split view container');
					}
				});
			});
		}
		this._splitView.layout(this._splitViewHeight);
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

	public get orientation(): string {
		return this._orientation.toString();
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
