/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Inject, NgModule, forwardRef, ApplicationRef, ComponentFactoryResolver } from '@angular/core';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes, UrlSerializer, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgGridModule } from 'angular2-grid';
import { ChartsModule } from 'ng2-charts/ng2-charts';

import CustomUrlSerializer from 'sql/common/urlSerializer';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { Extensions as ComponentExtensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';

import { Registry } from 'vs/platform/registry/common/platform';

/* Telemetry */
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import * as TelemetryKeys from 'sql/common/telemetryKeys';

/* Services */
import { BreadcrumbService } from 'sql/parts/dashboard/services/breadcrumb.service';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

/* Directives */
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';

/* Base Components */
import { DashboardComponent, DASHBOARD_SELECTOR } from 'sql/parts/dashboard/dashboard.component';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { DashboardWidgetContainer } from 'sql/parts/dashboard/containers/dashboardWidgetContainer.component';
import { DashboardGridContainer } from 'sql/parts/dashboard/containers/dashboardGridContainer.component';
import { DashboardWebviewContainer } from 'sql/parts/dashboard/containers/dashboardWebviewContainer.component';
import { DashboardModelViewContainer } from 'sql/parts/dashboard/containers/dashboardModelViewContainer.component';
import { DashboardErrorContainer } from 'sql/parts/dashboard/containers/dashboardErrorContainer.component';
import { DashboardNavSection } from 'sql/parts/dashboard/containers/dashboardNavSection.component';
import { WidgetContent } from 'sql/parts/dashboard/contents/widgetContent.component';
import { ModelViewContent } from 'sql/parts/modelComponents/modelViewContent.component';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import { WebviewContent } from 'sql/parts/dashboard/contents/webviewContent.component';
import { BreadcrumbComponent } from 'sql/base/browser/ui/breadcrumb/breadcrumb.component';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { DashboardHomeContainer } from 'sql/parts/dashboard/containers/dashboardHomeContainer.component';
import { ControlHostContent } from 'sql/parts/dashboard/contents/controlHostContent.component';
import { DashboardControlHostContainer } from 'sql/parts/dashboard/containers/dashboardControlHostContainer.component';
import { JobsViewComponent } from 'sql/parts/jobManagement/views/jobsView.component';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';

let baseComponents = [DashboardHomeContainer, DashboardComponent, DashboardWidgetWrapper, DashboardWebviewContainer,
	DashboardWidgetContainer, DashboardGridContainer, DashboardErrorContainer, DashboardNavSection, ModelViewContent, WebviewContent, WidgetContent,
	ComponentHostDirective, BreadcrumbComponent, ControlHostContent, DashboardControlHostContainer,
	JobsViewComponent, AgentViewComponent, JobHistoryComponent, JobStepsViewComponent, DashboardModelViewContainer, ModelComponentWrapper,
	ScrollableDirective];

/* Panel */
import { PanelModule } from 'sql/base/browser/ui/panel/panel.module';

/* Pages */
import { ServerDashboardPage } from 'sql/parts/dashboard/pages/serverDashboardPage.component';
import { DatabaseDashboardPage } from 'sql/parts/dashboard/pages/databaseDashboardPage.component';

let pageComponents = [ServerDashboardPage, DatabaseDashboardPage];

/* Widget Components */
import { PropertiesWidgetComponent } from 'sql/parts/dashboard/widgets/properties/propertiesWidget.component';
import { ExplorerWidget } from 'sql/parts/dashboard/widgets/explorer/explorerWidget.component';
import { TasksWidget } from 'sql/parts/dashboard/widgets/tasks/tasksWidget.component';
import { InsightsWidget } from 'sql/parts/dashboard/widgets/insights/insightsWidget.component';
import { WebviewWidget } from 'sql/parts/dashboard/widgets/webview/webviewWidget.component';
import { JobStepsViewComponent } from '../jobManagement/views/jobStepsView.component';
import { ScrollableDirective } from 'sql/base/browser/ui/scrollable/scrollable.directive';

let widgetComponents = [
	PropertiesWidgetComponent,
	ExplorerWidget,
	TasksWidget,
	InsightsWidget,
	WebviewWidget
];

/* Insights */
let insightComponents = Registry.as<IInsightRegistry>(Extensions.InsightContribution).getAllCtors();

/* Model-backed components */
let extensionComponents = Registry.as<IComponentRegistry>(ComponentExtensions.ComponentContribution).getAllCtors();

// Setup routes for various child components
const appRoutes: Routes = [
	{ path: 'database-dashboard', component: DatabaseDashboardPage },
	{ path: 'server-dashboard', component: ServerDashboardPage },
	{
		path: '',
		redirectTo: 'database-dashboard',
		pathMatch: 'full'
	},
	{ path: '**', component: DatabaseDashboardPage }
];

// Connection Dashboard main angular module
@NgModule({
	declarations: [
		...baseComponents,
		...pageComponents,
		...widgetComponents,
		...insightComponents,
		...extensionComponents
	],
	// also for widgets
	entryComponents: [
		DashboardComponent,
		...widgetComponents,
		...insightComponents,
		...extensionComponents
	],
	imports: [
		CommonModule,
		BrowserModule,
		FormsModule,
		NgGridModule,
		ChartsModule,
		RouterModule.forRoot(appRoutes),
		PanelModule
	],
	providers: [
		{ provide: APP_BASE_HREF, useValue: '/' },
		{ provide: IBreadcrumbService, useClass: BreadcrumbService },
		{ provide: CommonServiceInterface, useClass: DashboardServiceInterface },
		{ provide: UrlSerializer, useClass: CustomUrlSerializer }
	]
})
export class DashboardModule {
	private _bootstrap: DashboardServiceInterface;
	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => CommonServiceInterface)) bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => Router)) private _router: Router
	) {
		this._bootstrap = bootstrap as DashboardServiceInterface;
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(DashboardComponent);
		const uniqueSelector: string = this._bootstrapService.getUniqueSelector(DASHBOARD_SELECTOR);
		this._bootstrap.selector = uniqueSelector;
		(<any>factory).factory.selector = uniqueSelector;
		appRef.bootstrap(factory);

		this._router.events.subscribe(e => {
			if (e instanceof NavigationEnd) {
				this._bootstrap.handlePageNavigation();
				TelemetryUtils.addTelemetry(this._bootstrapService.telemetryService, TelemetryKeys.DashboardNavigated, {
					numberOfNavigations: this._bootstrap.getNumberOfPageNavigations(),
					routeUrl: e.url
				});
			}
		});
	}
}
