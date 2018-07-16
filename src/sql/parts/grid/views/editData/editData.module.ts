/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ApplicationRef, ComponentFactoryResolver, NgModule, Inject, forwardRef, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { SlickGrid } from 'angular2-slickgrid';

import { EditDataComponent } from 'sql/parts/grid/views/editData/editData.component';
import { IBootstrapParams, ISelector, providerIterator } from 'sql/services/bootstrap/bootstrapService';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const EditDataModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {

	@NgModule({

		imports: [
			CommonModule,
			BrowserModule
		],

		declarations: [
			EditDataComponent,
			SlickGrid
		],

		entryComponents: [
			EditDataComponent
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
			const factory = this._resolver.resolveComponentFactory(EditDataComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
