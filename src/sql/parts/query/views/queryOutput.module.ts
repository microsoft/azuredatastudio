/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/


import { ApplicationRef, ComponentFactoryResolver, forwardRef, NgModule, Inject, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { SlickGrid } from 'angular2-slickgrid';
import { ChartsModule } from 'ng2-charts/ng2-charts';

const BrowserAnimationsModule = (<any>require.__$__nodeRequire('@angular/platform-browser/animations')).BrowserAnimationsModule;

import { IBootstrapParams, ISelector, providerIterator } from 'sql/services/bootstrap/bootstrapService';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';

import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';


import { QueryOutputComponent } from 'sql/parts/query/views/queryOutput.component';
import { QueryPlanComponent, } from 'sql/parts/queryPlan/queryPlan.component';
import { QueryComponent } from 'sql/parts/grid/views/query/query.component';
import { TopOperationsComponent } from 'sql/parts/queryPlan/topOperations.component';

import { ChartViewerComponent } from 'sql/parts/grid/views/query/chartViewer.component';

import { PanelModule } from 'sql/base/browser/ui/panel/panel.module';

/* Directives */
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { MouseDownDirective } from 'sql/parts/grid/directives/mousedown.directive';
import { ScrollDirective } from 'sql/parts/grid/directives/scroll.directive';

import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox.component';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox.component';

let baseComponents = [QueryComponent, ComponentHostDirective, QueryOutputComponent, QueryPlanComponent, TopOperationsComponent, ChartViewerComponent];
/* Insights */
let insightComponents = Registry.as<IInsightRegistry>(Extensions.InsightContribution).getAllCtors();

export const QueryOutputModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {

	@NgModule({
		imports: [
			CommonModule,
			BrowserModule,
			FormsModule,
			BrowserAnimationsModule,
			ChartsModule,
			PanelModule
		],
		declarations: [
			...baseComponents,
			...insightComponents,
			SlickGrid,
			ScrollDirective,
			MouseDownDirective,
			Checkbox,
			SelectBox,
			InputBox
		],
		entryComponents: [
			QueryOutputComponent,
			...insightComponents
		],
		providers: [
			{ provide: IBootstrapParams, useValue: params },
			{ provide: ISelector, useValue: selector },
			...providerIterator(instantiationService)
		]
	})
	class ModuleClass {

		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
			@Inject(ISelector) private selector: string
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			const factory = this._resolver.resolveComponentFactory(QueryOutputComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
