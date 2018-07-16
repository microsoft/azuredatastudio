/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Routes, RouterModule } from '@angular/router';
import { ApplicationRef, ComponentFactoryResolver, ModuleWithProviders, NgModule,
	Inject, forwardRef } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';

import { TaskDialogComponent, TASKDIALOG_SELECTOR } from 'sql/parts/tasks/dialog/taskDialog.component';
import { CreateDatabaseComponent } from 'sql/parts/admin/database/create/createDatabase.component';

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
	providers: [{ provide: APP_BASE_HREF, useValue: '/' }]
})
export class TaskDialogModule {

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(TaskDialogComponent);
		const uniqueSelector: string = this._bootstrapService.getUniqueSelector(TASKDIALOG_SELECTOR);
		(<any>factory).factory.selector = uniqueSelector;
		appRef.bootstrap(factory);
	}
}
