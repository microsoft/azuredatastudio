/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PropertiesContainer } from './propertiesContainer.component';
import { LoadingSpinnerModule } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner.module';

@NgModule({
	imports: [CommonModule, LoadingSpinnerModule],
	exports: [PropertiesContainer],
	declarations: [PropertiesContainer]
})
export class PropertiesContainerModule { }
