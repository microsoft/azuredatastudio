/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/flexContainer';
import * as DOM from 'vs/base/browser/dom';
import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy } from '@angular/core';

import { FlexItemLayout, SplitViewLayout, SplitViewContainer, CssStyles } from 'azdata';
import { FlexItem } from './flexContainer.component';
import { ContainerBase, ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { Event } from 'vs/base/common/event';
import { SplitView, Orientation, Sizing, IView } from 'vs/base/browser/ui/splitview/splitview';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { convertSize, convertSizeToNumber } from 'sql/base/browser/dom';
import { debounce } from 'vs/base/common/decorators';

class SplitPane implements IView {
	orientation: Orientation;
	element: HTMLElement;
	minimumSize: number;
	maximumSize: number;
	onDidChange: Event<number> = Event.None;
	size: number;
	component: ComponentBase<SplitViewContainer>;
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
		<div *ngIf="items" class="splitViewContainer" [ngStyle]="CSSStyles">
			<div *ngFor="let item of items" [style.flex]="getItemFlex(item)" [style.textAlign]="textAlign" [style.order]="getItemOrder(item)" [ngStyle]="getItemStyles(item)">
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})

export default class SplitViewContainerImpl extends ContainerBase<FlexItemLayout> implements IComponent, OnDestroy {
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
	private _splitViewSize: number;
	private _resizeable: boolean;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
		this._flexFlow = '';	// default
		this._justifyContent = '';	// default
		this._orientation = Orientation.VERTICAL; // default

		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.resizeSplitview();
		}));
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	ngAfterViewInit(): void {
		this._splitView = this._register(new SplitView(this._el.nativeElement, { orientation: this._orientation }));
		this.baseInit();
	}

	private GetCorrespondingView(component: IComponent, orientation: Orientation): IView {
		let c = component as ComponentBase<SplitViewContainer>;
		let basicView: SplitPane = new SplitPane();
		basicView.orientation = orientation;
		basicView.element = c.getHtml();
		basicView.component = c;
		basicView.minimumSize = 50;
		basicView.maximumSize = Number.MAX_VALUE;
		return basicView;
	}

	@debounce(20)
	private resizeSplitview() {
		if (this._resizeable) {
			this._splitViewSize = this.calculateSplitViewSize(this.orientation);
			this._splitView.layout(this._splitViewSize);
		}
	}

	/**
	 * Calculates the size of the split view based on the dimensions of the model view container and orientation of the splitview
	 * @param orientation
	 * @returns
	 */
	private calculateSplitViewSize(orientation: string): number {
		const modelViewContainer = DOM.findParentWithClass(this._el.nativeElement, 'model-view-container');
		const modelViewContainerRect = modelViewContainer.getBoundingClientRect();
		return orientation.toLowerCase() === 'vertical' ? modelViewContainerRect.height : modelViewContainerRect.width;
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

		if (!layout.splitViewSize) {
			// if no size was passed in for the split view, use the dimensions of the model view container
			this._resizeable = true;
			this._splitViewSize = this.calculateSplitViewSize(layout.orientation);
		} else {
			this._resizeable = false;
			this._splitViewSize = convertSizeToNumber(layout.splitViewSize);
		}

		const layoutOrientation = layout.orientation.toLowerCase() === 'vertical' ? Orientation.VERTICAL : Orientation.HORIZONTAL;

		if (this._orientation !== layoutOrientation) {
			// have to recreate the splitview if the orientation changed because the SplitView needs the orientation when it's constructed for knowing
			// which direction everyting should be (scrollbars, sashes, CSS classes), and these can't be swapped to the other orientation afterwards
			this._splitView.el.remove();
			this._splitView.dispose();

			this._splitView = this._register(new SplitView(this._el.nativeElement, { orientation: layoutOrientation }));
			this._orientation = layoutOrientation;
		}

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

		this._splitView.layout(this._splitViewSize);
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

	public override get height(): string {
		return this._height;
	}

	public override get width(): string {
		return this._width;
	}

	public get alignContent(): string {
		return this._alignContent;
	}

	public get textAlign(): string {
		return this._textAlign;
	}

	public override get position(): string {
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

	public getItemStyles(item: FlexItem): CssStyles {
		return item.config && item.config.CSSStyles ? item.config.CSSStyles : {};
	}

	public override get CSSStyles(): CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth(),
			'height': this.getHeight(),
			'flexFlow': this.flexFlow,
			'justifyContent': this.justifyContent,
			'position': this.position,
			'alignItems': this.alignItems,
			'alignContent': this.alignContent
		});
	}
}
