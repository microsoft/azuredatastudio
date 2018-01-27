/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./tabHeader';

import { Component, AfterContentInit, OnDestroy, Input, Output, ElementRef, ViewChild, EventEmitter } from '@angular/core';

import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';

import { TabComponent } from './tab.component';

@Component({
	selector: 'tab-header',
	template: `
		<div class="tab-header" style="display: flex; flex: 0 0; flex-direction: row-reverse;">
			<span #actionbar style="flex: 0 0 auto; align-self: end"></span>
			<span class="tab" (click)="selectTab(tab)">
				<a class="tabLabel" [class.active]="tab.active">
					{{tab.title}}
				</a>
			</span>
		</div>
	`
})
export class TabHeaderComponent implements AfterContentInit, OnDestroy {
	@Input() public tab: TabComponent;
	@Output() public onSelectTab: EventEmitter<TabComponent> = new EventEmitter<TabComponent>();

	private _actionbar: ActionBar;

	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;
	constructor() { }

	ngAfterContentInit(): void {
		this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
		if (this.tab.actions) {
			this._actionbar.push(this.tab.actions, { icon: true, label: false });
		}
	}

	ngOnDestroy() {
		if (this._actionbar) {
			this._actionbar.dispose();
		}
	}

	selectTab(tab: TabComponent) {
		this.onSelectTab.emit(tab);
	}
}
