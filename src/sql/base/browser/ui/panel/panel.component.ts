/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, ContentChildren, QueryList, AfterContentInit, Inject, forwardRef, NgZone, OnInit, Input, EventEmitter, Output, ViewChild, ElementRef, OnChanges } from '@angular/core';

import { TabComponent } from './tab.component';
import './panelStyles';

import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
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
					<div *ngFor="let tab of _tabs">
						<tab-header [tab]="tab" (onSelectTab)='selectTab($event)' (onCloseTab)='closeTab($event)'> </tab-header>
					</div>
				</div>
				<div class="title-actions">
					<div #panelActionbar class="panel-actions" style="flex: 0 0 auto; align-self: end; margin-top: auto; margin-bottom: auto;" >
					</div>
				</div>
			</div>
			<ng-content class="fullsize"></ng-content>
		</div>
	`
})
export class PanelComponent implements AfterContentInit, OnInit, OnChanges {
	@Input() public options: IPanelOptions;
	@Input() public actions: Array<Action>;
	@ContentChildren(TabComponent) private _tabs: QueryList<TabComponent>;

	@Output() public onTabChange = new EventEmitter<TabComponent>();
	@Output() public onTabClose = new EventEmitter<TabComponent>();

	private _activeTab: TabComponent;
	private _actionbar: ActionBar;
	private _mru: TabComponent[];

	@ViewChild('panelActionbar', { read: ElementRef }) private _actionbarRef: ElementRef;
	constructor( @Inject(forwardRef(() => NgZone)) private _zone: NgZone) { }

	ngOnInit(): void {
		this.options = mixin(this.options || {}, defaultOptions, false);
		this._mru = [];
	}

	ngAfterContentInit(): void {
		if (this._tabs && this._tabs.length > 0) {
			this._activeTab = this._tabs.first;
			this._activeTab.active = true;
		}
	}

	ngOnChanges(): void {
		if (this._actionbarRef && !this._actionbar) {
			this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
		}
		if (this.actions) {
			this._actionbar.clear();
			this._actionbar.push(this.actions, { icon: true, label: false });
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
				this.setMostRecentlyUsed(tab);
				this._activeTab.active = true;
				this.onTabChange.emit(tab);
			});
		}
	}

	private indexOf(candidate: TabComponent, tabs: TabComponent[]): number {
		if (!candidate) {
			return -1;
		}

		for (let i = 0; i < tabs.length; i++) {
			if (candidate === tabs[i]) {
				return i;
			}
		}

		return -1;
	}

	private findAndRemoveTabFromMRU(tab: TabComponent): void {
		const mruIndex = this.indexOf(tab, this._mru);

		if (mruIndex !== -1) {
			// Remove old index
			this._mru.splice(mruIndex, 1);
		}
	}

	private setMostRecentlyUsed(tab: TabComponent): void {
		this.findAndRemoveTabFromMRU(tab);

		// Set tab to front
		this._mru.unshift(tab);
	}

	/**
	 * Close a tab
	 * @param tab tab to close
	 */
	closeTab(tab: TabComponent) {
		this.onTabClose.emit(tab);

		// remove the closed tab from mru
		this.findAndRemoveTabFromMRU(tab);

		// Open the most recent tab
		if (this._mru.length > 0) {
			this.selectTab(this._mru[0]);
		}
	}
}
