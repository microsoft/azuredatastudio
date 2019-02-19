/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, ContentChildren, QueryList, Inject, forwardRef, NgZone,
	Input, EventEmitter, Output, ViewChild, ElementRef
} from '@angular/core';

import './panelStyles';

import { TabComponent } from './tab.component';
import { ScrollableDirective } from 'sql/base/browser/ui/scrollable/scrollable.directive';
import { subscriptionToDisposable } from 'sql/base/node/lifecycle';

import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import * as types from 'vs/base/common/types';
import { mixin } from 'vs/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
import { ScrollbarVisibility } from 'vs/editor/common/standalone/standaloneEnums';

export interface IPanelOptions {
	/**
	 * Whether or not to show the tabs if there is only one tab present
	 */
	showTabsWhenOne?: boolean;
	layout?: NavigationBarLayout;
	showIcon?: boolean;
}

export enum NavigationBarLayout {
	horizontal = 0,
	vertical = 1
}

const defaultOptions: IPanelOptions = {
	showTabsWhenOne: true,
	layout: NavigationBarLayout.horizontal,
	showIcon: false
};

let idPool = 0;

@Component({
	selector: 'panel',
	template: `
		<div class="tabbedPanel fullsize" [ngClass]="options.layout === NavigationBarLayout.vertical ? 'vertical' : 'horizontal'">
			<div *ngIf="!options.showTabsWhenOne ? _tabs.length !== 1 : true" class="composite title">
				<div class="tabContainer">
					<div class="tabList" role="tablist" scrollable [horizontalScroll]="ScrollbarVisibility.Auto" [verticalScroll]="ScrollbarVisibility.Hidden" [scrollYToX]="true">
						<div role="presentation" *ngFor="let tab of _tabs">
							<tab-header role="presentation" [active]="_activeTab === tab" [tab]="tab" [showIcon]="options.showIcon" (onSelectTab)='selectTab($event)' (onCloseTab)='closeTab($event)'></tab-header>
						</div>
					</div>
				</div>
				<div class="title-actions">
					<div #panelActionbar class="panel-actions" style="flex: 0 0 auto; align-self: end; margin-top: auto; margin-bottom: auto;" >
					</div>
				</div>
			</div>
			<div class="tab-content">
				<div class="fullsize" style="position: absolute">
					<ng-content></ng-content>
				</div>
			</div>
		</div>
	`
})
export class PanelComponent extends Disposable {
	@Input() public options: IPanelOptions;
	@Input() public actions: Array<Action>;
	@ContentChildren(TabComponent) private _tabs: QueryList<TabComponent>;
	@ViewChild(ScrollableDirective) private scrollable: ScrollableDirective;

	@Output() public onTabChange = new EventEmitter<TabComponent>();
	@Output() public onTabClose = new EventEmitter<TabComponent>();

	private _activeTab: TabComponent;
	private _actionbar: ActionBar;
	private _mru: TabComponent[];

	protected ScrollbarVisibility = ScrollbarVisibility;
	protected NavigationBarLayout = NavigationBarLayout;

	@ViewChild('panelActionbar', { read: ElementRef }) private _actionbarRef: ElementRef;
	constructor( @Inject(forwardRef(() => NgZone)) private _zone: NgZone) {
		super();
	}

	ngOnInit(): void {
		this.options = mixin(this.options || {}, defaultOptions, false);
		this._mru = [];
	}

	ngAfterContentInit(): void {
		if (this._tabs && this._tabs.length > 0) {
			this.selectTab(this._tabs.first);
		}

		this._register(subscriptionToDisposable(this._tabs.changes.subscribe(() => {
			if (this._tabs && this._tabs.length > 0) {
				this.selectTab(this._tabs.first);
			}
		})));
	}

	ngOnChanges(): void {
		if (this._actionbarRef && !this._actionbar) {
			this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
		}
		if (this.actions && this._actionbar) {
			this._actionbar.clear();
			this._actionbar.push(this.actions, { icon: true, label: false });
		}
	}

	ngAfterViewInit(): void {
		this._tabs.changes.subscribe(() => {
			if (this.scrollable) {
				this.scrollable.layout();
			}
		});
		if (this.scrollable) {
			this.scrollable.layout();
		}
	}

	ngOnDestroy() {
		if (this._actionbar) {
			this._actionbar.dispose();
		}
		if (this.actions && this.actions.length > 0) {
			this.actions.forEach((action) => action.dispose());
		}
		this.dispose();
	}

	/**
	 * Select a tab based on index (unrecommended)
	 * @param index index of tab in the html
	 */
	selectTab(index: number);
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
				tab = this._tabs.toArray()[input];
			} else if (types.isString(input)) {
				tab = this._tabs.find(i => i.identifier === input);
			}

			// since we need to compare identifiers in this next step we are going to go through and make sure all tabs have one
			this._tabs.forEach(i => {
				if (!i.identifier) {
					i.identifier = 'tabIndex_' + idPool++;
				}
			});

			if (this._activeTab && tab === this._activeTab) {
				this.onTabChange.emit(tab);
				return;
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

	/**
	 * Get the id of the active tab
	 */
	public get getActiveTab(): string {
		return this._activeTab.identifier;
	}

	/**
	 * Select on the next tab
	 */
	public selectOnNextTab(): void {
		let activeIndex = this._tabs.toArray().findIndex(i => i === this._activeTab);
		let nextTabIndex = activeIndex + 1;
		if (nextTabIndex === this._tabs.length) {
			nextTabIndex = 0;
		}
		this.selectTab(nextTabIndex);
	}

	private findAndRemoveTabFromMRU(tab: TabComponent): void {
		let mruIndex = this._mru.findIndex(i => i === tab);

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

	public layout() {
		this._activeTab.layout();
	}
}
