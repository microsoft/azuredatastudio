/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';

import { forwardRef, NgModule, ComponentFactoryResolver, Inject, ApplicationRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { DialogContainer } from 'sql/platform/dialog/dialogContainer.component';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { ModelViewContent } from 'sql/parts/modelComponents/modelViewContent.component';
import { ModelComponentWrapper } from 'sql/parts/modelComponents/modelComponentWrapper.component';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { BOOTSTRAP_SERVICE_ID, IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { Registry } from 'vs/platform/registry/common/platform';

/* Model-backed components */
let extensionComponents = Registry.as<IComponentRegistry>(Extensions.ComponentContribution).getAllCtors();

@NgModule({
	declarations: [
		DialogContainer,
		ModelViewContent,
		ModelComponentWrapper,
		ComponentHostDirective,
		...extensionComponents
	],
	entryComponents: [DialogContainer, ...extensionComponents],
	imports: [
		FormsModule,
		CommonModule,
		BrowserModule
	],
	providers: [{ provide: APP_BASE_HREF, useValue: '/' }, CommonServiceInterface]
})
export class DialogModule {

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => CommonServiceInterface)) bootstrap: CommonServiceInterface,
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factoryWrapper: any = this._resolver.resolveComponentFactory(DialogContainer);
		const uniqueSelector: string = this._bootstrapService.getUniqueSelector('dialog-modelview-container');
		factoryWrapper.factory.selector = uniqueSelector;
		appRef.bootstrap(factoryWrapper);
	}
}
