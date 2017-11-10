/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ApplicationRef, ComponentFactoryResolver, NgModule, Inject, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';

import { EditDataComponent, EDITDATA_SELECTOR } from 'sql/parts/grid/views/editData/editData.component';
import { SlickGrid } from 'angular2-slickgrid';

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
	]
})
export class EditDataModule {

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(EditDataComponent);
		const uniqueSelector: string = this._bootstrapService.getUniqueSelector(EDITDATA_SELECTOR);
		(<any>factory).factory.selector = uniqueSelector;
		appRef.bootstrap(factory);
	}
}
