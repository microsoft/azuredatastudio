/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { NgModule, Inject, forwardRef, ApplicationRef, ComponentFactoryResolver, Type } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { IBootstrapParams, providerIterator } from 'sql/services/bootstrap/bootstrapService';
import { CreateLoginComponent } from 'sql/parts/admin/security/createLogin.component';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// Connection Dashboard main angular module
export const CreateLoginModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {

	@NgModule({
		declarations: [
			CreateLoginComponent
		],
		entryComponents: [CreateLoginComponent],
		imports: [
			CommonModule,
			BrowserModule
		],
		providers: [
			{ provide: APP_BASE_HREF, useValue: '/' },
			{ provide: IBootstrapParams, useValue: params },
			...providerIterator(instantiationService)
		]
	})
	class ModuleClass {

		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			const factory = this._resolver.resolveComponentFactory(CreateLoginComponent);
			(<any>factory).factory.selector = selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
