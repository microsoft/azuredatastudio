/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ApplicationRef, ComponentFactoryResolver, NgModule, Inject, forwardRef, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { EditDataComponent, EDITDATA_SELECTOR } from 'sql/parts/grid/views/editData/editData.component';
import { SlickGrid } from 'angular2-slickgrid';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';

export const EditDataModule = (params: IBootstrapParams, selector: string): Type<any> => {

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
			{ provide: IBootstrapParams, useValue: params }
		]
	})
	class ModuleClass {

		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			const factory = this._resolver.resolveComponentFactory(EditDataComponent);
			(<any>factory).factory.selector = selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
