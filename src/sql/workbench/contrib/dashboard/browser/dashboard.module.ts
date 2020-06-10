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
import { ChartsModule } from 'ng2-charts';

import CustomUrlSerializer from 'sql/base/browser/urlSerializer';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/browser/insightRegistry';
import { Extensions as ComponentExtensions, IComponentRegistry } from 'sql/platform/dashboard/browser/modelComponentRegistry';
import { providerIterator } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { IBootstrapParams, ISelector } from 'sql/workbench/services/bootstrap/common/bootstrapParams';

import { Registry } from 'vs/platform/registry/common/platform';

/* Telemetry */
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

/* Services */
import { BreadcrumbService } from 'sql/workbench/contrib/dashboard/browser/services/breadcrumb.service';
import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';

/* Directives */
import { ComponentHostDirective } from 'sql/base/browser/componentHost.directive';

/* Base Components */
import { DashboardComponent } from 'sql/workbench/contrib/dashboard/browser/dashboard.component';
import { DashboardWidgetWrapper } from 'sql/workbench/contrib/dashboard/browser/contents/dashboardWidgetWrapper.component';
import { DashboardWidgetContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.component';
import { DashboardGridContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.component';
import { DashboardWebviewContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWebviewContainer.component';
import { DashboardModelViewContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardModelViewContainer.component';
import { DashboardErrorContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardErrorContainer.component';
import { DashboardNavSection } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardNavSection.component';
import { WidgetContent } from 'sql/workbench/contrib/dashboard/browser/contents/widgetContent.component';
import { ModelViewContent } from 'sql/workbench/browser/modelComponents/modelViewContent.component';
import { ModelComponentWrapper } from 'sql/workbench/browser/modelComponents/modelComponentWrapper.component';
import { WebviewContent } from 'sql/workbench/contrib/dashboard/browser/contents/webviewContent.component';
import { BreadcrumbComponent } from 'sql/base/browser/ui/breadcrumb/breadcrumb.component';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { DashboardHomeContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardHomeContainer.component';
import { ControlHostContent } from 'sql/workbench/contrib/dashboard/browser/contents/controlHostContent.component';
import { DashboardControlHostContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardControlHostContainer.component';
import { JobsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/jobsView.component';
import { AgentViewComponent } from 'sql/workbench/contrib/jobManagement/browser/agentView.component';
import { AlertsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/alertsView.component';
import { JobHistoryComponent } from 'sql/workbench/contrib/jobManagement/browser/jobHistory.component';
import { OperatorsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/operatorsView.component';
import { ProxiesViewComponent } from 'sql/workbench/contrib/jobManagement/browser/proxiesView.component';
import { NotebooksViewComponent } from 'sql/workbench/contrib/jobManagement/browser/notebooksView.component';
import { NotebookHistoryComponent } from 'sql/workbench/contrib/jobManagement/browser/notebookHistory.component';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/platform/browser/selectBox/selectBox.component';
import { InputBox } from 'sql/platform/browser/inputbox/inputBox.component';
import { EditableDropDown } from 'sql/platform/browser/editableDropdown/editableDropdown.component';
import { AsmtViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtView.component';
import { AsmtResultsViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtResultsView.component';

const baseComponents = [DashboardHomeContainer, DashboardComponent, DashboardWidgetWrapper, DashboardWebviewContainer,
	DashboardWidgetContainer, DashboardGridContainer, DashboardErrorContainer, DashboardNavSection, ModelViewContent, WebviewContent, WidgetContent,
	ComponentHostDirective, BreadcrumbComponent, ControlHostContent, DashboardControlHostContainer,
	JobsViewComponent, NotebooksViewComponent, AgentViewComponent, JobHistoryComponent, NotebookHistoryComponent, JobStepsViewComponent, AlertsViewComponent, ProxiesViewComponent, OperatorsViewComponent,
	DashboardModelViewContainer, ModelComponentWrapper, Checkbox, EditableDropDown, SelectBox, InputBox, AsmtViewComponent, AsmtResultsViewComponent];

/* Panel */
import { PanelModule } from 'sql/base/browser/ui/panel/panel.module';

import { ScrollableModule } from 'sql/base/browser/ui/scrollable/scrollable.module';

/* Pages */
import { ServerDashboardPage } from 'sql/workbench/contrib/dashboard/browser/pages/serverDashboardPage.component';
import { DatabaseDashboardPage } from 'sql/workbench/contrib/dashboard/browser/pages/databaseDashboardPage.component';

const pageComponents = [ServerDashboardPage, DatabaseDashboardPage];

/* Widget Components */
import { PropertiesWidgetComponent } from 'sql/workbench/contrib/dashboard/browser/widgets/properties/propertiesWidget.component';
import { ExplorerWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerWidget.component';
import { InsightsWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/insightsWidget.component';
import { WebviewWidget } from 'sql/workbench/contrib/dashboard/browser/widgets/webview/webviewWidget.component';
import { JobStepsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/jobStepsView.component';
import { IInstantiationService, _util } from 'vs/platform/instantiation/common/instantiation';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { PropertiesContainerModule } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.module';
import { LoadingSpinnerModule } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner.module';


const widgetComponents = [
	PropertiesWidgetComponent,
	ExplorerWidget,
	InsightsWidget,
	WebviewWidget
];

/* Insights */
const insightComponents = Registry.as<IInsightRegistry>(Extensions.InsightContribution).getAllCtors();

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
export const DashboardModule = (params, selector: string, instantiationService: IInstantiationService): any => {

	/* Model-backed components */
	const extensionComponents = Registry.as<IComponentRegistry>(ComponentExtensions.ComponentContribution).getAllCtors();

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
			PanelModule,
			ScrollableModule,
			PropertiesContainerModule,
			LoadingSpinnerModule
		],
		providers: [
			{ provide: APP_BASE_HREF, useValue: '/' },
			{ provide: IBreadcrumbService, useClass: BreadcrumbService },
			{ provide: CommonServiceInterface, useClass: DashboardServiceInterface },
			{ provide: UrlSerializer, useClass: CustomUrlSerializer },
			{ provide: IBootstrapParams, useValue: params },
			{ provide: ISelector, useValue: selector },
			...providerIterator(instantiationService)
		]
	})
	class ModuleClass {
		private navigations = 0;
		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
			@Inject(forwardRef(() => Router)) private _router: Router,
			@Inject(IAdsTelemetryService) private _telemetryService: IAdsTelemetryService,
			@Inject(ISelector) private selector: string
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			const factory = this._resolver.resolveComponentFactory(DashboardComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);

			this._router.events.subscribe(e => {
				if (e instanceof NavigationEnd) {
					this.navigations++;
					this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.DashboardNavigated)
						.withAdditionalProperties({ numberOfNavigations: this.navigations })
						.send();
				}
			});
		}
	}

	return ModuleClass;
};
