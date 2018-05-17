/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ApplicationRef, ComponentFactoryResolver, NgModule, Inject, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { EditDataComponent, EDITDATA_SELECTOR } from 'sql/parts/grid/views/editData/editData.component';
import { SlickGrid } from 'angular2-slickgrid';
import { IUniqueSelector } from 'sql/services/bootstrap/bootstrapService';

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
		@Inject(IUniqueSelector) private uniqueSelector: IUniqueSelector
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(EditDataComponent);
		(<any>factory).factory.selector = this.uniqueSelector;
		appRef.bootstrap(factory);
	}
}
