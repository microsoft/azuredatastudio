/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TabComponent } from './tab.component';
import { TabHeaderComponent } from './tabHeader.component';
import { PanelComponent } from './panel.component';

import { ScrollableModule } from 'sql/base/browser/ui/scrollable/scrollable.module';

@NgModule({
	imports: [CommonModule, ScrollableModule],
	exports: [TabComponent, PanelComponent],
	declarations: [TabComponent, TabHeaderComponent, PanelComponent]
})
export class PanelModule { }
