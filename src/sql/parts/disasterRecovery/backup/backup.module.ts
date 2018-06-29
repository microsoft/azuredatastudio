/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import {
	ApplicationRef, ComponentFactoryResolver, NgModule,
	Inject, forwardRef, Type
} from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { IBootstrapParams, ISelector, providerIterator } from 'sql/services/bootstrap/bootstrapService';
import { BackupComponent } from 'sql/parts/disasterRecovery/backup/backup.component';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// work around
const BrowserAnimationsModule = (<any>require.__$__nodeRequire('@angular/platform-browser/animations')).BrowserAnimationsModule;

// Backup wizard main angular module
export const BackupModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {
	@NgModule({
		declarations: [
			BackupComponent
		],
		entryComponents: [BackupComponent],
		imports: [
			FormsModule,
			CommonModule,
			BrowserModule,
			BrowserAnimationsModule,
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
			const factory = this._resolver.resolveComponentFactory(BackupComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
