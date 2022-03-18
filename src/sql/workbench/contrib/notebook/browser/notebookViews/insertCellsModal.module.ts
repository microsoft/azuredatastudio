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
import { providerIterator } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IBootstrapParams, ISelector } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import CardComponent from 'sql/workbench/browser/modelComponents/card.component';
import DivContainer from 'sql/workbench/browser/modelComponents/divContainer.component';
import { ModelComponentWrapper } from 'sql/workbench/browser/modelComponents/modelComponentWrapper.component';
import { InsertCellsScreenshots } from 'sql/workbench/contrib/notebook/browser/notebookViews/insertCellsScreenshots.component';
import ImageComponent from 'sql/workbench/browser/modelComponents/image.component';

// Insertcells main angular module
export const InsertCellsModule = (params: IBootstrapParams, selector: string, instantiationService: IInstantiationService): Type<any> => {
	@NgModule({
		declarations: [
			CardComponent,
			DivContainer,
			ModelComponentWrapper,
			InsertCellsScreenshots,
			ImageComponent,
		],
		entryComponents: [InsertCellsScreenshots, CardComponent, ImageComponent],
		imports: [
			FormsModule,
			CommonModule,
			BrowserModule
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
			const factory = this._resolver.resolveComponentFactory(InsertCellsScreenshots);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);
		}
	}
	return ModuleClass;
};
