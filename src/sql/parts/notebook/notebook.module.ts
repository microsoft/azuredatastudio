/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import { forwardRef, NgModule, ComponentFactoryResolver, Inject, ApplicationRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';


import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { IBootstrapParams, ISelector, providerIterator } from 'sql/services/bootstrap/bootstrapService';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox.component';
import { EditableDropDown } from 'sql/base/browser/ui/editableDropdown/editableDropdown.component';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox.component';
import { NotebookComponent } from 'sql/parts/notebook/notebook.component';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CodeComponent } from 'sql/parts/notebook/cellViews/code.component';
import { CodeCellComponent } from 'sql/parts/notebook/cellViews/codeCell.component';
import { TextCellComponent } from 'sql/parts/notebook/cellViews/textCell.component';
import { OutputAreaComponent } from 'sql/parts/notebook/cellViews/outputArea.component';
import { OutputComponent } from 'sql/parts/notebook/cellViews/output.component';
import { PlaceholderCellComponent } from 'sql/parts/notebook/cellViews/placeholderCell.component';
import LoadingSpinner from 'sql/parts/modelComponents/loadingSpinner.component';

export const NotebookModule = (params, selector: string, instantiationService: IInstantiationService): any => {
	@NgModule({
		declarations: [
			Checkbox,
			SelectBox,
			EditableDropDown,
			InputBox,
			LoadingSpinner,
			CodeComponent,
			CodeCellComponent,
			TextCellComponent,
			PlaceholderCellComponent,
			NotebookComponent,
			ComponentHostDirective,
			OutputAreaComponent,
			OutputComponent
		],
		entryComponents: [NotebookComponent],
		imports: [
			FormsModule,
			CommonModule,
			BrowserModule
		],
		providers: [
			{ provide: APP_BASE_HREF, useValue: '/' },
			CommonServiceInterface,
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
			const factoryWrapper: any = this._resolver.resolveComponentFactory(NotebookComponent);
			factoryWrapper.factory.selector = this.selector;
			appRef.bootstrap(factoryWrapper);
		}
	}

	return ModuleClass;
};
