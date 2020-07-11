/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { forwardRef, NgModule, ComponentFactoryResolver, Inject, ApplicationRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { ComponentHostDirective } from 'sql/base/browser/componentHost.directive';
import { providerIterator } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { EditableDropDown } from 'sql/platform/browser/editableDropdown/editableDropdown.component';
import { NotebookComponent } from 'sql/workbench/contrib/notebook/browser/notebook.component';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CodeComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/code.component';
import { CodeCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/codeCell.component';
import { OutputAreaComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/outputArea.component';
import { OutputComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/output.component';
import { StdInComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/stdin.component';
import { PlaceholderCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/placeholderCell.component';
import LoadingSpinner from 'sql/base/browser/ui/loadingSpinner/loadingSpinner.component';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/platform/browser/selectBox/selectBox.component';
import { InputBox } from 'sql/platform/browser/inputbox/inputBox.component';
import { IMimeComponentRegistry, Extensions } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { LinkHandlerDirective } from 'sql/workbench/contrib/notebook/browser/cellViews/linkHandler.directive';
import { IBootstrapParams, ISelector } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { ICellComponenetRegistry, Extensions as OutputComponentExtensions } from 'sql/platform/notebooks/common/outputRegistry';
import { CollapseComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/collapse.component';
import { MarkdownToolbarComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/markdownToolbar.component';
import { CellToolbarComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/cellToolbar.component';

const outputComponentRegistry = Registry.as<ICellComponenetRegistry>(OutputComponentExtensions.CellComponentContributions);

export const NotebookModule = (params, selector: string, instantiationService: IInstantiationService): any => {
	let outputComponents = Registry.as<IMimeComponentRegistry>(Extensions.MimeComponentContribution).getAllCtors();

	@NgModule({
		declarations: [
			...outputComponentRegistry.getComponents(),
			Checkbox,
			SelectBox,
			EditableDropDown,
			InputBox,
			LoadingSpinner,
			CodeComponent,
			CodeCellComponent,
			CellToolbarComponent,
			MarkdownToolbarComponent,
			PlaceholderCellComponent,
			NotebookComponent,
			ComponentHostDirective,
			OutputAreaComponent,
			OutputComponent,
			StdInComponent,
			CollapseComponent,
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
