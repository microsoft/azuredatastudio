/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModule, Inject, forwardRef, ApplicationRef, ComponentFactoryResolver, Type } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { providerIterator } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { QueryPlanComponent } from 'sql/workbench/contrib/queryPlan/browser/queryPlan.component';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IBootstrapParams, ISelector } from 'sql/workbench/services/bootstrap/common/bootstrapParams';

// Connection Dashboard main angular module
export const QueryPlanModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {

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
			const factory = this._resolver.resolveComponentFactory(QueryPlanComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
