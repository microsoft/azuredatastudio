/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, ContentChildren, QueryList, AfterContentInit, Inject, forwardRef, NgZone, OnInit, Input } from '@angular/core';

import { TabComponent } from './tab.component';
import './panelStyles';

import * as types from 'vs/base/common/types';
import { mixin } from 'vs/base/common/objects';

export interface IPanelOptions {
	/**
	 * Whether or not to show the tabs if there is only one tab present
	 */
	showTabsWhenOne?: boolean;
}

const defaultOptions: IPanelOptions = {
	showTabsWhenOne: true
};

@Component({
	selector: 'panel',
	template: `
		<div class="tabbedPanel fullsize">
			<div *ngIf="!options.showTabsWhenOne ? _tabs.length !== 1 : true" class="composite title">
				<div class="tabList">
					<div *ngFor="let tab of _tabs" class="tab" (click)="selectTab(tab)">
						<a class="tabLabel" [class.active]="tab.active">
							{{tab.title}}
						</a>
					</div>
				</div>
				<div class="title-actions">
				</div>
			</div>
			<ng-content class="fullsize"></ng-content>
		</div>
	`
})
export class PanelComponent implements AfterContentInit, OnInit {
	@Input() public options: IPanelOptions;
	@ContentChildren(TabComponent) private _tabs: QueryList<TabComponent>;
	private _activeTab: TabComponent;

	constructor( @Inject(forwardRef(() => NgZone)) private _zone: NgZone) { }

	ngOnInit(): void {
		this.options = mixin(this.options || {}, defaultOptions, false);
	}

	ngAfterContentInit(): void {
		if (this._tabs && this._tabs.length > 0) {
			this._activeTab = this._tabs.first;
			this._activeTab.active = true;
		}
	}

	/**
	 * Select a tab based on index (unrecommended)
	 * @param index index of tab in the html
	 */
	selectTab(index: number)
	/**
	 * Select a tab based on the identifier that was passed into the tab
	 * @param identifier specified identifer of the tab
	 */
	selectTab(identifier: string);
	/**
	 * Select a tab directly if you have access to the object
	 * @param tab tab to navigate to
	 */
	selectTab(tab: TabComponent);
	selectTab(input: TabComponent | number | string) {
		if (this._tabs && this._tabs.length > 0) {
			let tab: TabComponent;
			if (input instanceof TabComponent) {
				tab = input;
			} else if (types.isNumber(input)) {
				tab = this._tabs[input];
			} else if (types.isString(input)) {
				tab = this._tabs.find(i => i.identifier === input);
			}

			this._zone.run(() => {
				if (this._activeTab) {
					this._activeTab.active = false;
				}

				this._activeTab = tab;
				this._activeTab.active = true;
			});
		}
	}
}
