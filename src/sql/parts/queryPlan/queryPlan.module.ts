/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { NgModule, Inject, forwardRef, ApplicationRef, ComponentFactoryResolver, Type } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { QueryPlanComponent, QUERYPLAN_SELECTOR } from 'sql/parts/queryPlan/queryPlan.component';

// Connection Dashboard main angular module
export const QueryPlanModule = (params: IBootstrapParams, selector: string): Type<any> => {

	@NgModule({
		declarations: [
			QueryPlanComponent
		],
		entryComponents: [QueryPlanComponent],
		imports: [
			CommonModule,
			BrowserModule
		],
		providers: [
			{ provide: APP_BASE_HREF, useValue: '/' },
			{ provide: IBootstrapParams, useValue: params }
		]
	})
	class ModuleClass {

		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			const factory = this._resolver.resolveComponentFactory(QueryPlanComponent);
			(<any>factory).factory.selector = selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};