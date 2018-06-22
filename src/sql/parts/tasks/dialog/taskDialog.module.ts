/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Routes, RouterModule } from '@angular/router';
import {
	ApplicationRef, ComponentFactoryResolver, ModuleWithProviders, NgModule,
	Inject, forwardRef, Type
} from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { TaskDialogComponent } from 'sql/parts/tasks/dialog/taskDialog.component';
import { CreateDatabaseComponent } from 'sql/parts/admin/database/create/createDatabase.component';
import { IBootstrapParams, ISelector, providerIterator } from 'sql/services/bootstrap/bootstrapService';

// Setup routes for various child components
const appRoutes: Routes = [
	{ path: 'create-database', component: CreateDatabaseComponent },
	{
		path: '',
		redirectTo: '/create-database',
		pathMatch: 'full'
	},
	{ path: '**', component: CreateDatabaseComponent }
];

export const TaskDialogModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {
	@NgModule({
		declarations: [
			TaskDialogComponent,
			CreateDatabaseComponent
		],
		entryComponents: [TaskDialogComponent],
		imports: [
			FormsModule,
			CommonModule,
			BrowserModule,
			<ModuleWithProviders>RouterModule.forRoot(appRoutes)
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
			const factory = this._resolver.resolveComponentFactory(TaskDialogComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}

	return ModuleClass;
};
