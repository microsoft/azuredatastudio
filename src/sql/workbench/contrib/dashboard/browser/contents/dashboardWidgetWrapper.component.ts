/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./dashboardWidgetWrapper';

import {
	Component, Input, Inject, forwardRef, ComponentFactoryResolver, ViewChild,
	ElementRef, OnInit, ChangeDetectorRef, ReflectiveInjector, Injector, Type, ComponentRef
} from '@angular/core';

import { ComponentHostDirective } from 'sql/base/browser/componentHost.directive';
import { WidgetConfig, WIDGET_CONFIG, IDashboardWidget } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/browser/insightRegistry';
import { RefreshWidgetAction, ToggleMoreWidgetAction, DeleteWidgetAction, CollapseWidgetAction } from 'sql/workbench/contrib/dashboard/browser/core/actions';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

/* Widgets */
import { PropertiesWidgetComponent } from 'sql/workbench/contrib/dashboard/browser/widgets/properties/propertiesWidget.component';
import { ExplorerWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerWidget.component';
import { TasksWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/tasks/tasksWidget.component';
import { InsightsWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/insightsWidget.component';
import { WebviewWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/webview/webviewWidget.component';

import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as themeColors from 'vs/workbench/common/theme';
import { Action, IAction } from 'vs/base/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { memoize } from 'vs/base/common/decorators';
import { generateUuid } from 'vs/base/common/uuid';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { values } from 'vs/base/common/collections';
import { IColorTheme } from 'vs/platform/theme/common/themeService';

const componentMap: { [x: string]: Type<IDashboardWidget> } = {
	'properties-widget': PropertiesWidgetComponent,
	'explorer-widget': ExplorerWidget,
	'tasks-widget': TasksWidget,
	'insights-widget': InsightsWidget,
	'webview-widget': WebviewWidget
};

@Component({
	selector: 'dashboard-widget-wrapper',
	templateUrl: decodeURI(require.toUrl('./dashboardWidgetWrapper.component.html'))
})
export class DashboardWidgetWrapper extends AngularDisposable implements OnInit {
	@Input() private _config: WidgetConfig;
	@Input() private collapsable = false;

	private _collapseAction: CollapseWidgetAction;
	private _collapsed = false;

	public get collapsed(): boolean {
		return this._collapsed;
	}

	public set collapsed(val: boolean) {
		if (val === this._collapsed) {
			return;
		}
		this._collapsed = val;
		this._collapseAction.state = val;
		this._changeref.detectChanges();
		if (!val) {
			this.loadWidget();
		}
	}

	@memoize
	public get guid(): string {
		return generateUuid();
	}

	private _actions: Array<Action>;
	private _component: IDashboardWidget;
	private _actionbar: ActionBar;

	@ViewChild('header', { read: ElementRef }) private header: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;
	@ViewChild(ComponentHostDirective) componentHost: ComponentHostDirective;

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver,
		@Inject(forwardRef(() => ElementRef)) private _ref: ElementRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeref: ChangeDetectorRef,
		@Inject(forwardRef(() => Injector)) private _injector: Injector,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(ILogService) private logService: ILogService
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange((event: IColorTheme) => {
			this.updateTheme(event);
		}));
	}

	ngAfterViewInit() {
		this.updateTheme(this.themeService.getColorTheme());
		if (this.componentHost) {
			this.loadWidget();
		}
		this._changeref.detectChanges();
		this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
		if (this._actions) {
			if (this.collapsable) {
				this._collapseAction = this.instantiationService.createInstance(CollapseWidgetAction, this._bootstrap.getUnderlyingUri(), this.guid, this.collapsed);
				this._actionbar.push(this._collapseAction, { icon: true, label: false });
			}
			this._actionbar.push(this.instantiationService.createInstance(ToggleMoreWidgetAction, this._actions as Array<IAction>, this._component.actionsContext), { icon: true, label: false });
		}
		this.layout();
	}

	public refresh(): void {
		if (!this.collapsed && this._component && this._component.refresh) {
			this._component.refresh();
		}
	}

	public layout(): void {
		if (!this.collapsed && this._component && this._component.layout) {
			this._component.layout();
		}
	}

	public get id(): string {
		return this._config.id;
	}

	public enableEdit(): void {
		this._actionbar.push(this.instantiationService.createInstance(DeleteWidgetAction, this._config.id, this._bootstrap.getUnderlyingUri()), { icon: true, label: false });
	}

	public disableEdit(): void {
		this._actionbar.pull(this._actionbar.length() - 1);
	}

	private loadWidget(): void {
		if (Object.keys(this._config.widget).length !== 1) {
			this.logService.error('Exactly 1 widget must be defined per space');
			return;
		}
		const key = Object.keys(this._config.widget)[0];
		const selector = this.getOrCreateSelector(key);
		if (selector === undefined) {
			this.logService.error('Could not find selector', key);
			return;
		}

		// If _config.name is not set, set it to _config.widget.name
		if (!this._config.name) {
			const widget = values(this._config.widget)[0];
			if (widget && widget.name) {
				this._config.name = widget.name;
			}
		}

		const componentFactory = this._componentFactoryResolver.resolveComponentFactory(selector);

		const viewContainerRef = this.componentHost.viewContainerRef;
		viewContainerRef.clear();

		const injector = ReflectiveInjector.resolveAndCreate([{ provide: WIDGET_CONFIG, useValue: this._config }], this._injector);
		let componentRef: ComponentRef<IDashboardWidget>;
		try {
			componentRef = viewContainerRef.createComponent(componentFactory, 0, injector);
			this._component = componentRef.instance;
			const actions = componentRef.instance.actions;
			if (componentRef.instance.refresh) {
				actions.push(new RefreshWidgetAction(this.refresh, this));
			}
			if (actions !== undefined && actions.length > 0) {
				this._actions = actions;
				this._changeref.detectChanges();
			}
		} catch (e) {
			this.logService.error('Error rendering widget', key, e);
			return;
		}
		const el = <HTMLElement>componentRef.location.nativeElement;

		// set widget styles to conform to its box
		el.style.overflow = 'hidden';
		el.style.flex = '1 1 auto';
		el.style.position = 'relative';
	}

	/**
	 * Attempts to get the selector for a given key, and if none is defined tries
	 * to load it from the widget registry and configure as needed
	 */
	private getOrCreateSelector(key: string): Type<IDashboardWidget> {
		let selector = componentMap[key];
		if (selector === undefined) {
			// Load the widget from the registry
			const widgetRegistry = <IInsightRegistry>Registry.as(Extensions.InsightContribution);
			const insightConfig = widgetRegistry.getRegisteredExtensionInsights(key);
			if (insightConfig === undefined) {
				return undefined;
			}
			// Save the widget for future use
			selector = componentMap['insights-widget'];
			delete this._config.widget[key];
			this._config.widget['insights-widget'] = insightConfig;
		}
		return selector;
	}

	private updateTheme(theme: IColorTheme): void {
		const el = <HTMLElement>this._ref.nativeElement;
		const headerEl: HTMLElement = this.header.nativeElement;
		let borderColor = theme.getColor(themeColors.DASHBOARD_BORDER);
		let backgroundColor = theme.getColor(colors.editorBackground, true);
		const foregroundColor = theme.getColor(themeColors.SIDE_BAR_FOREGROUND, true);
		const border = theme.getColor(colors.contrastBorder, true);

		if (this._config.background_color) {
			backgroundColor = theme.getColor(this._config.background_color);
		}

		if (this._config.border === 'none') {
			borderColor = undefined;
		}

		if (backgroundColor) {
			el.style.backgroundColor = backgroundColor.toString();
		}

		if (foregroundColor) {
			el.style.color = foregroundColor.toString();
		}

		let borderString = undefined;
		if (border) {
			borderString = border.toString();
			el.style.borderColor = borderString;
			el.style.borderWidth = '1px';
			el.style.borderStyle = 'solid';
		} else if (borderColor) {
			borderString = borderColor;
			el.style.border = '1px solid ' + borderColor;
		} else {
			el.style.border = 'none';
		}

		if (this._config.fontSize) {
			headerEl.style.fontSize = this._config.fontSize;
		}
		if (this._config.fontWeight) {
			headerEl.style.fontWeight = this._config.fontWeight;
		}
		if (this._config.padding) {
			headerEl.style.padding = this._config.padding;
		}
	}
}
