/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ApplicationRef, ComponentFactoryResolver, NgModule, Inject, forwardRef, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { SlickGrid } from 'angular2-slickgrid';
<<<<<<< HEAD:src/sql/workbench/contrib/editData/browser/editData.module.ts
import { EditDataGridPanel, } from 'sql/workbench/contrib/editData/browser/editDataGridPanel';
=======
import { EditDataGridPanel, } from 'sql/workbench/parts/editData/browser/editDataGridPanel';
>>>>>>> af419910762501aea875f9470d30d331b4c6a433:src/sql/workbench/parts/editData/browser/editData.module.ts
import { providerIterator } from 'sql/platform/bootstrap/browser/bootstrapService';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IBootstrapParams, ISelector } from 'sql/platform/bootstrap/common/bootstrapParams';

export const EditDataModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {

	@NgModule({

		imports: [
			CommonModule,
			BrowserModule,
		],

		declarations: [
			EditDataGridPanel,
			SlickGrid
		],

		entryComponents: [
			EditDataGridPanel
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
			const factory = this._resolver.resolveComponentFactory(EditDataGridPanel);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
