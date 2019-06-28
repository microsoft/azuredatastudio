/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { forwardRef, NgModule, ComponentFactoryResolver, Inject, ApplicationRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { ComponentHostDirective } from 'sql/workbench/parts/dashboard/common/componentHost.directive';
import { IBootstrapParams, ISelector, providerIterator } from 'sql/platform/bootstrap/node/bootstrapService';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { EditableDropDown } from 'sql/platform/electron-browser/editableDropdown/editableDropdown.component';
import { NotebookComponent } from 'sql/workbench/parts/notebook/notebook.component';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CodeComponent } from 'sql/workbench/parts/notebook/cellViews/code.component';
import { CodeCellComponent } from 'sql/workbench/parts/notebook/cellViews/codeCell.component';
import { TextCellComponent } from 'sql/workbench/parts/notebook/cellViews/textCell.component';
import { OutputAreaComponent } from 'sql/workbench/parts/notebook/cellViews/outputArea.component';
import { OutputComponent } from 'sql/workbench/parts/notebook/cellViews/output.component';
import { StdInComponent } from 'sql/workbench/parts/notebook/cellViews/stdin.component';
import { PlaceholderCellComponent } from 'sql/workbench/parts/notebook/cellViews/placeholderCell.component';
import LoadingSpinner from 'sql/workbench/electron-browser/modelComponents/loadingSpinner.component';
import { Checkbox } from 'sql/base/electron-browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/platform/ui/electron-browser/selectBox/selectBox.component';
import { InputBox } from 'sql/base/electron-browser/ui/inputBox/inputBox.component';
import { IMimeComponentRegistry, Extensions } from 'sql/workbench/parts/notebook/outputs/mimeRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { LinkHandlerDirective } from 'sql/workbench/parts/notebook/cellViews/linkHandler.directive';

export const NotebookModule = (params, selector: string, instantiationService: IInstantiationService): any => {
	let outputComponents = Registry.as<IMimeComponentRegistry>(Extensions.MimeComponentContribution).getAllCtors();

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
			OutputComponent,
			StdInComponent,
			LinkHandlerDirective,
			...outputComponents
		],
		entryComponents: [
			NotebookComponent,
			...outputComponents
		],
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
