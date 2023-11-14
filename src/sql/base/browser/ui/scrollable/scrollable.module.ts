/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScrollableDirective } from './scrollable.directive';

@NgModule({
	imports: [CommonModule],
	exports: [ScrollableDirective],
	declarations: [ScrollableDirective]
})
export class ScrollableModule { }
