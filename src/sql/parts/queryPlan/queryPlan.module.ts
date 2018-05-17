/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { NgModule, Inject, forwardRef, ApplicationRef, ComponentFactoryResolver } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { IUniqueSelector } from 'sql/services/bootstrap/bootstrapService';
import { QueryPlanComponent, QUERYPLAN_SELECTOR } from 'sql/parts/queryPlan/queryPlan.component';

// Connection Dashboard main angular module
@NgModule({
	declarations: [
		QueryPlanComponent
	],
	entryComponents: [QueryPlanComponent],
	imports: [
		CommonModule,
		BrowserModule
	],
	providers: [{ provide: APP_BASE_HREF, useValue: '/' }]
})
export class QueryPlanModule {

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(IUniqueSelector) private selector: IUniqueSelector
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(QueryPlanComponent);
		(<any>factory).factory.selector = this.selector;
		appRef.bootstrap(factory);
	}
}
