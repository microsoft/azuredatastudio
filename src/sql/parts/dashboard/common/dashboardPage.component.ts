/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardPage';

import { Component, Inject, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NgGridConfig, NgGrid, NgGridItem } from 'angular2-grid';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/common/dashboardWidgetWrapper.component';
import { subscriptionToDisposable } from 'sql/base/common/lifecycle';
import { IPropertiesConfig } from 'sql/parts/dashboard/pages/serverDashboardPage.contribution';

import { Registry } from 'vs/platform/registry/common/platform';
import * as types from 'vs/base/common/types';
import { Severity } from 'vs/platform/message/common/message';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { addDisposableListener, getContentHeight, EventType } from 'vs/base/browser/dom';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as themeColors from 'vs/workbench/common/theme';
import { generateUuid } from 'vs/base/common/uuid';
import * as objects from 'sql/base/common/objects';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';

/**
 * @returns whether the provided parameter is a JavaScript Array and each element in the array is a number.
 */
function isNumberArray(value: any): value is number[] {
	return types.isArray(value) && (<any[]>value).every(elem => types.isNumber(elem));
}

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
	selector: 'dashboard-page',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/common/dashboardPage.component.html'))
})
export abstract class DashboardPage extends Disposable implements OnDestroy {

	protected SKELETON_WIDTH = 5;
	protected widgets: Array<WidgetConfig> = [];
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
	private _originalConfig: WidgetConfig[];
	private _editDispose: Array<IDisposable> = [];
	private _scrollableElement: ScrollableElement;

	private _widgetConfigLocation: string;
	private _propertiesConfigLocation: string;

	@ViewChild('properties') private _properties: DashboardWidgetWrapper;
	@ViewChild(NgGrid) private _grid: NgGrid;
	@ViewChild('scrollable', { read: ElementRef }) private _scrollable: ElementRef;
	@ViewChild('scrollContainer', { read: ElementRef }) private _scrollContainer: ElementRef;
	@ViewChild('propertiesContainer', { read: ElementRef }) private _propertiesContainer: ElementRef;
	@ViewChildren(DashboardWidgetWrapper) private _widgets: QueryList<DashboardWidgetWrapper>;
	@ViewChildren(NgGridItem) private _items: QueryList<NgGridItem>;

	// a set of config modifiers
	private readonly _configModifiers: Array<(item: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		this.removeEmpty,
		this.initExtensionConfigs,
		this.addProvider,
		this.addEdition,
		this.addContext,
		this.filterWidgets
	];

	private readonly _gridModifiers: Array<(item: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		this.validateGridConfig
	];

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	protected init() {
		if (!this.dashboardService.connectionManagementService.connectionInfo) {
			this.dashboardService.messageService.show(Severity.Warning, nls.localize('missingConnectionInfo', 'No connection information could be found for this dashboard'));
		} else {
			let tempWidgets = this.dashboardService.getSettings<Array<WidgetConfig>>([this.context, 'widgets'].join('.'));
			this._widgetConfigLocation = 'default';
			this._originalConfig = objects.clone(tempWidgets);
			let properties = this.getProperties();
			this._configModifiers.forEach((cb) => {
				tempWidgets = cb.apply(this, [tempWidgets]);
				properties = properties ? cb.apply(this, [properties]) : undefined;
			});
			this._gridModifiers.forEach(cb => {
				tempWidgets = cb.apply(this, [tempWidgets]);
			});
			this.widgets = tempWidgets;
			this.propertiesWidget = properties ? properties[0] : undefined;
		}
	}

	ngAfterViewInit(): void {
		this._register(this.dashboardService.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.dashboardService.themeService.getColorTheme());
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
			this._scrollableElement.setScrollDimensions({
				scrollHeight: getContentHeight(scrollable),
				height: getContentHeight(container)
			});
		}));

		// unforunately because of angular rendering behavior we need to do a double check to make sure nothing changed after this point
		setTimeout(() => {
			let currentheight = getContentHeight(scrollable);
			if (initalHeight !== currentheight) {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: getContentHeight(scrollable),
					height: getContentHeight(container)
				});
			}
		}, 100);
	}

	private updateTheme(theme: IColorTheme): void {
		let el = this._propertiesContainer.nativeElement as HTMLElement;
		let border = theme.getColor(colors.contrastBorder, true);
		let borderColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true);

		if (border) {
			el.style.borderColor = border.toString();
			el.style.borderBottomWidth = '1px';
			el.style.borderBottomStyle = 'solid';
		} else if (borderColor) {
			el.style.borderBottom = '1px solid ' + borderColor.toString();
		} else {
			el.style.border = 'none';
		}

	}

	ngOnDestroy() {
		this.dispose();
	}

	protected abstract propertiesWidget: WidgetConfig;
	protected abstract get context(): string;

	/**
	 * Returns a filtered version of the widgets passed based on edition and provider
	 * @param config widgets to filter
	 */
	private filterWidgets(config: WidgetConfig[]): Array<WidgetConfig> {
		let connectionInfo: ConnectionManagementInfo = this.dashboardService.connectionManagementService.connectionInfo;
		let edition = connectionInfo.serverInfo.engineEditionId;
		let provider = connectionInfo.providerId;

		// filter by provider
		return config.filter((item) => {
			return this.stringCompare(item.provider, provider);
		}).filter((item) => {
			if (item.edition) {
				if (edition) {
					return this.stringCompare(isNumberArray(item.edition) ? item.edition.map(item => item.toString()) : item.edition.toString(), edition.toString());
				} else {
					this.dashboardService.messageService.show(Severity.Warning, nls.localize('providerMissingEdition', 'Widget filters based on edition, but the provider does not have an edition'));
					return true;
				}
			} else {
				return true;
			}
		});
	}

	/**
	 * Does a compare against the val passed in and the compare string
	 * @param val string or array of strings to compare the compare value to; if array, it will compare each val in the array
	 * @param compare value to compare to
	 */
	private stringCompare(val: string | Array<string>, compare: string): boolean {
		if (types.isUndefinedOrNull(val)) {
			return true;
		} else if (types.isString(val)) {
			return val === compare;
		} else if (types.isStringArray(val)) {
			return val.some(item => item === compare);
		} else {
			return false;
		}
	}

	/**
	 * Add provider to the passed widgets and returns the new widgets
	 * @param widgets Array of widgets to add provider onto
	 */
	protected addProvider(config: WidgetConfig[]): Array<WidgetConfig> {
		let provider = this.dashboardService.connectionManagementService.connectionInfo.providerId;
		return config.map((item) => {
			if (item.provider === undefined) {
				item.provider = provider;
			}
			return item;
		});
	}

	/**
	 * Adds the edition to the passed widgets and returns the new widgets
	 * @param widgets Array of widgets to add edition onto
	 */
	protected addEdition(config: WidgetConfig[]): Array<WidgetConfig> {
		let connectionInfo: ConnectionManagementInfo = this.dashboardService.connectionManagementService.connectionInfo;
		let edition = connectionInfo.serverInfo.engineEditionId;
		return config.map((item) => {
			if (item.edition === undefined) {
				item.edition = edition;
			}
			return item;
		});
	}

	/**
	 * Adds the context to the passed widgets and returns the new widgets
	 * @param widgets Array of widgets to add context to
	 */
	protected addContext(config: WidgetConfig[]): Array<WidgetConfig> {
		let context = this.context;
		return config.map((item) => {
			if (item.context === undefined) {
				item.context = context;
			}
			return item;
		});
	}

	/**
	 * Validates configs to make sure nothing will error out and returns the modified widgets
	 * @param config Array of widgets to validate
	 */
	protected removeEmpty(config: WidgetConfig[]): Array<WidgetConfig> {
		return config.filter(widget => {
			return !types.isUndefinedOrNull(widget);
		});
	}

	/**
	 * Validates configs to make sure nothing will error out and returns the modified widgets
	 * @param config Array of widgets to validate
	 */
	protected validateGridConfig(config: WidgetConfig[]): Array<WidgetConfig> {
		return config.map((widget, index) => {
			if (widget.gridItemConfig === undefined) {
				widget.gridItemConfig = {};
			}
			const id = generateUuid();
			widget.gridItemConfig.payload = { id };
			widget.id = id;
			this._originalConfig[index].id = id;
			return widget;
		});
	}

	protected initExtensionConfigs(configurations: WidgetConfig[]): Array<WidgetConfig> {
		let widgetRegistry = <IInsightRegistry>Registry.as(Extensions.InsightContribution);
		return configurations.map((config) => {
			if (config.widget && Object.keys(config.widget).length === 1) {
				let key = Object.keys(config.widget)[0];
				let insightConfig = widgetRegistry.getRegisteredExtensionInsights(key);
				if (insightConfig !== undefined) {
					// Setup the default properties for this extension if needed
					if (!config.provider && insightConfig.provider) {
						config.provider = insightConfig.provider;
					}
					if (!config.name && insightConfig.name) {
						config.name = insightConfig.name;
					}
					if (!config.edition && insightConfig.edition) {
						config.edition = insightConfig.edition;
					}
					if (!config.gridItemConfig && insightConfig.gridItemConfig) {
						config.gridItemConfig = {
							sizex: insightConfig.gridItemConfig.x,
							sizey: insightConfig.gridItemConfig.y
						};
					}
					if (config.gridItemConfig && !config.gridItemConfig.sizex && insightConfig.gridItemConfig && insightConfig.gridItemConfig.x) {
						config.gridItemConfig.sizex = insightConfig.gridItemConfig.x;
					}
					if (config.gridItemConfig && !config.gridItemConfig.sizey && insightConfig.gridItemConfig && insightConfig.gridItemConfig.y) {
						config.gridItemConfig.sizey = insightConfig.gridItemConfig.y;
					}
				}
			}
			return config;
		});
	}

	private getProperties(): Array<WidgetConfig> {
		let properties = this.dashboardService.getSettings<IPropertiesConfig[]>([this.context, 'properties'].join('.'));
		this._propertiesConfigLocation = 'default';
		if (types.isUndefinedOrNull(properties)) {
			return [this.propertiesWidget];
		} else if (types.isBoolean(properties)) {
			return properties ? [this.propertiesWidget] : [];
		} else if (types.isArray(properties)) {
			return properties.map((item) => {
				let retVal = Object.assign({}, this.propertiesWidget);
				retVal.edition = item.edition;
				retVal.provider = item.provider;
				retVal.widget = { 'properties-widget': { properties: item.properties } };
				return retVal;
			});
		} else {
			return undefined;
		}
	}

	public refresh(refreshConfig: boolean = false): void {
		if (refreshConfig) {
			this.init();
			if (this._properties) {
				this._properties.refresh();
			}
		} else {
			if (this._widgets) {
				this._widgets.forEach(item => {
					item.refresh();
				});
			}
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

				index = this._originalConfig.findIndex(i => i.id === e);
				this._originalConfig.splice(index, 1);

				this._rewriteConfig();
				this._cd.detectChanges();
			}));
			this._editDispose.push(subscriptionToDisposable(this._grid.onResizeStop.subscribe((e: NgGridItem) => {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: getContentHeight(this._scrollable.nativeElement),
					height: getContentHeight(this._scrollContainer.nativeElement)
				});
				let event = e.getEventOutput();
				let config = this._originalConfig.find(i => i.id === event.payload.id);

				if (!config.gridItemConfig) {
					config.gridItemConfig = {};
				}
				config.gridItemConfig.sizex = e.sizex;
				config.gridItemConfig.sizey = e.sizey;

				let component = this._widgets.find(i => i.id === event.payload.id);

				component.layout();
				this._rewriteConfig();
			})));
			this._editDispose.push(subscriptionToDisposable(this._grid.onDragStop.subscribe((e: NgGridItem) => {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: getContentHeight(this._scrollable.nativeElement),
					height: getContentHeight(this._scrollContainer.nativeElement)
				});
				let event = e.getEventOutput();
				this._items.forEach(i => {
					let config = this._originalConfig.find(j => j.id === i.getEventOutput().payload.id);
					if ((config.gridItemConfig && config.gridItemConfig.col) || config.id === event.payload.id) {
						if (!config.gridItemConfig) {
							config.gridItemConfig = {};
						}
						config.gridItemConfig.col = i.col;
						config.gridItemConfig.row = i.row;
					}
				});
				this._originalConfig.sort(configSorter);

				this._rewriteConfig();
			})));
			this._widgets.forEach(i => {
				if (i.id) {
					i.enableEdit();
				}
			});
		}
	}

	private _rewriteConfig(): void {
		let writeableConfig = objects.clone(this._originalConfig);

		writeableConfig.forEach(i => {
			delete i.id;
		});
		let target: ConfigurationTarget = ConfigurationTarget.USER;
		this.dashboardService.writeSettings(this.context, writeableConfig, target);
	}
}
