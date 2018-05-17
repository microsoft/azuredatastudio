/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { NgModule, Inject, forwardRef, ApplicationRef, ComponentFactoryResolver } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { IUniqueSelector } from 'sql/services/bootstrap/bootstrapService';

import { CreateLoginComponent, CREATELOGIN_SELECTOR } from 'sql/parts/admin/security/createLogin.component';

// Connection Dashboard main angular module
@NgModule({
	declarations: [
		CreateLoginComponent
	],
	entryComponents: [CreateLoginComponent],
	imports: [
		CommonModule,
		BrowserModule
	],
	providers: [{ provide: APP_BASE_HREF, useValue: '/' }]
})
export class CreateLoginModule {

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(IUniqueSelector) private selector: IUniqueSelector
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(CreateLoginComponent);
		(<any>factory).factory.selector = this.selector;
		appRef.bootstrap(factory);
	}
}
