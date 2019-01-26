/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./widgetContent';

import { Component, Inject, Input, forwardRef, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, ElementRef, AfterViewInit } from '@angular/core';
import { NgGridConfig, NgGrid, NgGridItem } from 'angular2-grid';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { subscriptionToDisposable, AngularDisposable } from 'sql/base/node/lifecycle';

import { IDisposable } from 'vs/base/common/lifecycle';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import * as objects from 'vs/base/common/objects';
import { Event, Emitter } from 'vs/base/common/event';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { getContentHeight, addDisposableListener, EventType } from 'vs/base/browser/dom';

/**
 * Sorting function for dashboard widgets
 * In order of priority;
 * If neither have defined grid positions, they are equivalent
 * If a has a defined grid position and b does not; a should come first
 * If both have defined grid positions and have the same row; the one with the smaller col position should come first
 * If both have defined grid positions but different rows (it doesn't really matter in this case) the lowers row should come first
 */
function configSorter(a, b): number {
	if ((!a.gridItemConfig || !a.gridItemConfig.col)
		&& (!b.gridItemConfig || !b.gridItemConfig.col)) {
		return 0;
	} else if (!a.gridItemConfig || !a.gridItemConfig.col) {
		return 1;
	} else if (!b.gridItemConfig || !b.gridItemConfig.col) {
		return -1;
	} else if (a.gridItemConfig.row === b.gridItemConfig.row) {
		if (a.gridItemConfig.col < b.gridItemConfig.col) {
			return -1;
		}

		if (a.gridItemConfig.col === b.gridItemConfig.col) {
			return 0;
		}

		if (a.gridItemConfig.col > b.gridItemConfig.col) {
			return 1;
		}
	} else {
		if (a.gridItemConfig.row < b.gridItemConfig.row) {
			return -1;
		}

		if (a.gridItemConfig.row === b.gridItemConfig.row) {
			return 0;
		}

		if (a.gridItemConfig.row > b.gridItemConfig.row) {
			return 1;
		}
	}

	return void 0; // this should never be reached
}

@Component({
	selector: 'widget-content',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/contents/widgetContent.component.html'))
})
export class WidgetContent extends AngularDisposable implements AfterViewInit {
	@Input() private widgets: WidgetConfig[];
	@Input() private originalConfig: WidgetConfig[];
	@Input() private context: string;
	@Input() private scrollContent = true;

	private _scrollableElement: ScrollableElement;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	protected SKELETON_WIDTH = 5;
	protected gridConfig: NgGridConfig = {
		'margins': [10],            //  The size of the margins of each item. Supports up to four values in the same way as CSS margins. Can be updated using setMargins()
		'draggable': false,          //  Whether the items can be dragged. Can be updated using enableDrag()/disableDrag()
		'resizable': false,          //  Whether the items can be resized. Can be updated using enableResize()/disableResize()
		'max_cols': this.SKELETON_WIDTH,              //  The maximum number of columns allowed. Set to 0 for infinite. Cannot be used with max_rows
		'max_rows': 0,              //  The maximum number of rows allowed. Set to 0 for infinite. Cannot be used with max_cols
		'visible_cols': 0,          //  The number of columns shown on screen when auto_resize is set to true. Set to 0 to not auto_resize. Will be overriden by max_cols
		'visible_rows': 0,          //  The number of rows shown on screen when auto_resize is set to true. Set to 0 to not auto_resize. Will be overriden by max_rows
		'min_cols': 0,              //  The minimum number of columns allowed. Can be any number greater than or equal to 1.
		'min_rows': 0,              //  The minimum number of rows allowed. Can be any number greater than or equal to 1.
		'col_width': 250,           //  The width of each column
		'row_height': 250,          //  The height of each row
		'cascade': 'left',            //  The direction to cascade grid items ('up', 'right', 'down', 'left')
		'min_width': 100,           //  The minimum width of an item. If greater than col_width, this will update the value of min_cols
		'min_height': 100,          //  The minimum height of an item. If greater than row_height, this will update the value of min_rows
		'fix_to_grid': false,       //  Fix all item movements to the grid
		'auto_style': true,         //  Automatically add required element styles at run-time
		'auto_resize': false,       //  Automatically set col_width/row_height so that max_cols/max_rows fills the screen. Only has effect is max_cols or max_rows is set
		'maintain_ratio': false,    //  Attempts to maintain aspect ratio based on the colWidth/rowHeight values set in the config
		'prefer_new': false,        //  When adding new items, will use that items position ahead of existing items
		'limit_to_screen': true,   //  When resizing the screen, with this true and auto_resize false, the grid will re-arrange to fit the screen size. Please note, at present this only works with cascade direction up.
	};

	private _editDispose: Array<IDisposable> = [];

	@ViewChild(NgGrid) private _grid: NgGrid;
	@ViewChildren(DashboardWidgetWrapper) private _widgets: QueryList<DashboardWidgetWrapper>;
	@ViewChildren(NgGridItem) private _items: QueryList<NgGridItem>;
	@ViewChild('scrollable', { read: ElementRef }) private _scrollable: ElementRef;
	@ViewChild('scrollContainer', { read: ElementRef }) private _scrollContainer: ElementRef;

	protected dashboardService: DashboardServiceInterface;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) protected commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
		this.dashboardService = commonService as DashboardServiceInterface;
	}

	ngAfterViewInit() {
		if (this.scrollContent) {
			let container = this._scrollContainer.nativeElement as HTMLElement;
			let scrollable = this._scrollable.nativeElement as HTMLElement;
			container.removeChild(scrollable);

			this._scrollableElement = new ScrollableElement(scrollable, {
				horizontal: ScrollbarVisibility.Hidden,
				vertical: ScrollbarVisibility.Auto,
				useShadows: false
			});

			this._scrollableElement.onScroll(e => {
				scrollable.style.bottom = e.scrollTop + 'px';
			});

			container.appendChild(this._scrollableElement.getDomNode());
			let initalHeight = getContentHeight(scrollable);
			this._scrollableElement.setScrollDimensions({
				scrollHeight: getContentHeight(scrollable),
				height: getContentHeight(container)
			});

			this._register(addDisposableListener(window, EventType.RESIZE, () => {
				this.resetScrollDimensions();
			}));

			// unforunately because of angular rendering behavior we need to do a double check to make sure nothing changed after this point
			setTimeout(() => {
				let currentheight = getContentHeight(scrollable);
				if (initalHeight !== currentheight) {
					this._scrollableElement.setScrollDimensions({
						scrollHeight: currentheight,
						height: getContentHeight(container)
					});
				}
			}, 200);
		}
	}

	public layout() {
		if (this._widgets) {
			this._widgets.forEach(item => {
				item.layout();
			});
		}
		this._grid.triggerResize();
		if (this.scrollContent) {
			this.resetScrollDimensions();
		}
	}

	private resetScrollDimensions() {
		let container = this._scrollContainer.nativeElement as HTMLElement;
		let scrollable = this._scrollable.nativeElement as HTMLElement;

		this._scrollableElement.setScrollDimensions({
			scrollHeight: getContentHeight(scrollable),
			height: getContentHeight(container)
		});
	}

	public refresh(): void {
		if (this._widgets) {
			this._widgets.forEach(item => {
				item.refresh();
			});
		}
	}

	public enableEdit(): void {
		if (this._grid.dragEnable) {
			this._grid.disableDrag();
			this._grid.disableResize();
			this._editDispose.forEach(i => i.dispose());
			this._widgets.forEach(i => {
				if (i.id) {
					i.disableEdit();
				}
			});
			this._editDispose = [];
		} else {
			this._grid.enableResize();
			this._grid.enableDrag();
			this._editDispose.push(this.dashboardService.onDeleteWidget(e => {
				let index = this.widgets.findIndex(i => i.id === e);
				this.widgets.splice(index, 1);

				index = this.originalConfig.findIndex(i => i.id === e);
				this.originalConfig.splice(index, 1);

				this._rewriteConfig();
				this._cd.detectChanges();
			}));
			this._editDispose.push(subscriptionToDisposable(this._grid.onResizeStop.subscribe((e: NgGridItem) => {
				this._onResize.fire();
				let event = e.getEventOutput();
				let config = this.originalConfig.find(i => i.id === event.payload.id);

				if (!config.gridItemConfig) {
					config.gridItemConfig = {};
				}
				config.gridItemConfig.sizex = e.sizex;
				config.gridItemConfig.sizey = e.sizey;

				let component = this._widgets.find(i => i.id === event.payload.id);

				component.layout();
				this._rewriteConfig();
				this.resetScrollDimensions();
			})));
			this._editDispose.push(subscriptionToDisposable(this._grid.onDragStop.subscribe((e: NgGridItem) => {
				this._onResize.fire();
				let event = e.getEventOutput();
				this._items.forEach(i => {
					let config = this.originalConfig.find(j => j.id === i.getEventOutput().payload.id);
					if ((config.gridItemConfig && config.gridItemConfig.col) || config.id === event.payload.id) {
						if (!config.gridItemConfig) {
							config.gridItemConfig = {};
						}
						config.gridItemConfig.col = i.col;
						config.gridItemConfig.row = i.row;
					}
				});
				this.originalConfig.sort(configSorter);

				this._rewriteConfig();
				this.resetScrollDimensions();
			})));
			this._widgets.forEach(i => {
				if (i.id) {
					i.enableEdit();
				}
			});
		}
	}

	private _rewriteConfig(): void {
		let writeableConfig = objects.deepClone(this.originalConfig);

		writeableConfig.forEach(i => {
			delete i.id;
		});
		let target: ConfigurationTarget = ConfigurationTarget.USER;
		this.dashboardService.writeSettings([this.context, 'widgets'].join('.'), writeableConfig, target);
	}
}
