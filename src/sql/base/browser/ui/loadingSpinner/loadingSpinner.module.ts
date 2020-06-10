/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import LoadingSpinner from './loadingSpinner.component';

@NgModule({
	imports: [CommonModule],
	exports: [LoadingSpinner],
	declarations: [LoadingSpinner]
})
export class LoadingSpinnerModule { }
