/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, ContentChildren, QueryList, Inject, forwardRef, NgZone,
	Input, EventEmitter, Output, ViewChild, ElementRef, ChangeDetectorRef, ViewChildren
} from '@angular/core';

import { TabComponent } from 'sql/base/browser/ui/panel/tab.component';
import { ScrollableDirective } from 'sql/base/browser/ui/scrollable/scrollable.directive';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';

import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import * as types from 'vs/base/common/types';
import { mixin } from 'vs/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { firstIndex } from 'vs/base/common/arrays';
import * as nls from 'vs/nls';
import { TabHeaderComponent } from 'sql/base/browser/ui/panel/tabHeader.component';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IThemable } from 'vs/base/common/styler';
import { ITabbedPanelStyles } from 'sql/base/browser/ui/panel/panel';
import { createStyleSheet } from 'vs/base/browser/dom';

export interface IPanelOptions {
	/**
	 * Whether or not to show the tabs if there is only one tab present
	 */
	alwaysShowTabs?: boolean;
	layout?: NavigationBarLayout;
	showIcon?: boolean;
}

export enum NavigationBarLayout {
	horizontal = 0,
	vertical = 1
}

const defaultOptions: IPanelOptions = {
	alwaysShowTabs: true,
	layout: NavigationBarLayout.horizontal,
	showIcon: false
};

let idPool = 0;

@Component({
	selector: 'panel',
	template: `
		<div #rootContainer class="tabbedPanel fullsize" [ngClass]="_options.layout === NavigationBarLayout.vertical ? 'vertical' : 'horizontal'">
			<div *ngIf="!_options.alwaysShowTabs ? _tabs && _tabs.length !== 1 : true" class="composite title">
				<div class="tabContainer">
					<div *ngIf="_options.layout === NavigationBarLayout.vertical" class="vertical-tab-action-container">
						<button [attr.aria-expanded]="_tabExpanded" [title]="toggleTabPanelButtonAriaLabel" [attr.aria-label]="toggleTabPanelButtonAriaLabel" [ngClass]="toggleTabPanelButtonCssClass" tabindex="0" (click)="toggleTabPanel()"></button>
					</div>
					<div [style.display]="_tabExpanded ? 'flex': 'none'" [attr.aria-hidden]="_tabExpanded ? 'false': 'true'" class="tabList" role="tablist" (keydown)="onKey($event)">
						<div role="presentation" *ngFor="let tab of _tabs">
							<ng-container *ngIf="tab.type!=='group-header'">
								<tab-header role="presentation" [active]="_activeTab === tab" [tab]="tab" [showIcon]="_options.showIcon" (onSelectTab)='selectTab($event)' (onCloseTab)='closeTab($event)'></tab-header>
							</ng-container>
							<ng-container *ngIf="tab.type==='group-header' && _options.layout === NavigationBarLayout.vertical">
								<div class="tab-group-header">
									<span>{{tab.title}}</span>
								</div>
							</ng-container >
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
export class PanelComponent extends Disposable implements IThemable {
	private _options: IPanelOptions = defaultOptions;

	@Input() public set options(newOptions: IPanelOptions) {
		// Refresh for the case when the options are set
		// manually through code which doesn't trigger
		// Angular's change detection
		this._options = newOptions;
		this._cd.detectChanges();
	}

	@Input() public actions?: Array<Action>;
	@ContentChildren(TabComponent) private readonly _tabs!: QueryList<TabComponent>;
	@ViewChildren(TabHeaderComponent) private readonly _tabHeaders!: QueryList<TabHeaderComponent>;
	@ViewChild(ScrollableDirective) private scrollable?: ScrollableDirective;

	@Output() public onTabChange = new EventEmitter<TabComponent>();
	@Output() public onTabClose = new EventEmitter<TabComponent>();

	private _activeTab?: TabComponent;
	private _actionbar?: ActionBar;
	private _mru: TabComponent[] = [];
	private _tabExpanded: boolean = true;
	private _styleElement: HTMLStyleElement;

	protected AutoScrollbarVisibility = ScrollbarVisibility.Auto; // used by angular template
	protected HiddenScrollbarVisibility = ScrollbarVisibility.Hidden; // used by angular template
	protected NavigationBarLayout = NavigationBarLayout; // used by angular template

	@ViewChild('panelActionbar', { read: ElementRef }) private _actionbarRef!: ElementRef;
	@ViewChild('rootContainer', { read: ElementRef }) private _rootContainer!: ElementRef;

	constructor(
		@Inject(forwardRef(() => NgZone)) private _zone: NgZone,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef) {
		super();
	}

	public get toggleTabPanelButtonCssClass(): string {
		return this._tabExpanded ? 'tab-action collapse' : 'tab-action expand';
	}

	public get toggleTabPanelButtonAriaLabel(): string {
		return this._tabExpanded ? nls.localize('hideTextLabel', "Hide text labels") : nls.localize('showTextLabel', "Show text labels");
	}

	toggleTabPanel(): void {
		this._tabExpanded = !this._tabExpanded;
		this._cd.detectChanges();
	}

	ngOnInit(): void {
		this._options = mixin(this._options || {}, defaultOptions, false);
		const rootContainerElement = this._rootContainer.nativeElement as HTMLElement;
		this._styleElement = createStyleSheet(rootContainerElement);
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
	selectTab(index: number): void;
	/**
	 * Select a tab based on the identifier that was passed into the tab
	 * @param identifier specified identifer of the tab
	 */
	selectTab(identifier: string): void;
	/**
	 * Select a tab directly if you have access to the object
	 * @param tab tab to navigate to
	 */
	selectTab(tab: TabComponent): void;
	selectTab(input: TabComponent | number | string): void {
		if (this._tabs && this._tabs.length > 0) {
			let foundTab: TabComponent | undefined;
			if (input instanceof TabComponent) {
				foundTab = input;
			} else if (types.isNumber(input)) {
				foundTab = this._tabs.toArray()[input];
			} else if (types.isString(input)) {
				foundTab = this._tabs.find(i => i.identifier === input);
			}

			if (foundTab) {
				const tab = foundTab;
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
	}

	/**
	 * Get the id of the active tab
	 */
	public get getActiveTab(): string | undefined {
		return this._activeTab?.identifier;
	}

	/**
	 * Select on the next tab
	 */
	public selectOnNextTab(): void {
		let activeIndex = firstIndex(this._tabs.toArray(), i => i === this._activeTab);
		let nextTabIndex = activeIndex + 1;
		if (nextTabIndex === this._tabs.length) {
			nextTabIndex = 0;
		}
		this.selectTab(nextTabIndex);
	}

	/**
	 * Updates the specified tab with new config values
	 * @param tabId The id of the tab to update
	 * @param config The values to update the tab with
	 */
	public updateTab(tabId: string, config: { title?: string, iconClass?: string }): void {
		// First find the tab and update it with the new values. Then manually refresh the
		// tab header since it won't detect changes made to the corresponding tab by itself.
		let tabHeader: TabHeaderComponent;
		const tabHeaders = this._tabHeaders.toArray();
		const tab = this._tabs.find((item, i) => {
			if (item.identifier === tabId) {
				tabHeader = tabHeaders?.length > i ? tabHeaders[i] : undefined;
				return true;
			}
			return false;
		});

		if (tab) {
			tab.title = config.title;
			tab.iconClass = config.iconClass;
			tabHeader?.refresh();
		}
	}

	private findAndRemoveTabFromMRU(tab: TabComponent): void {
		let mruIndex = firstIndex(this._mru, i => i === tab);

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
		this._activeTab?.layout();
	}

	onKey(e: KeyboardEvent): void {
		const event = new StandardKeyboardEvent(e);
		let eventHandled: boolean = false;
		if (event.equals(KeyCode.DownArrow) || event.equals(KeyCode.RightArrow)) {
			this.focusNextTab();
			eventHandled = true;
		} else if (event.equals(KeyCode.UpArrow) || event.equals(KeyCode.LeftArrow)) {
			this.focusPreviousTab();
			eventHandled = true;
		}

		if (eventHandled) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	private focusPreviousTab(): void {
		const currentIndex = this.focusedTabHeaderIndex;
		if (currentIndex !== -1) {
			// Move to the previous tab, if we are at the first tab then move to the last tab.
			this.focusOnTabHeader(currentIndex === 0 ? this._tabHeaders.length - 1 : currentIndex - 1);
		}
	}

	private focusNextTab(): void {
		const currentIndex = this.focusedTabHeaderIndex;
		if (currentIndex !== -1) {
			// Move to the next tab, if we are at the last tab then move to the first tab.
			this.focusOnTabHeader(currentIndex === this._tabHeaders.length - 1 ? 0 : currentIndex + 1);
		}
	}

	private focusOnTabHeader(index: number): void {
		if (index >= 0 && index <= this._tabHeaders.length - 1) {
			this._tabHeaders.toArray()[index].focusOnTabHeader();
		}
	}

	private get focusedTabHeaderIndex(): number {
		return this._tabHeaders.toArray().findIndex((header) => {
			return header.nativeElement === document.activeElement;
		});
	}

	style(styles: ITabbedPanelStyles) {
		if (this._styleElement) {
			const content: string[] = [];
			if (styles.titleInactiveForeground) {
				content.push(`.tabbedPanel.horizontal > .title .tabList .tab-header {
					color: ${styles.titleInactiveForeground}
				}`);
			}
			if (styles.titleActiveBorder && styles.titleActiveForeground) {
				content.push(`.tabbedPanel.horizontal > .title .tabList .tab-header:focus,
					.tabbedPanel.horizontal > .title .tabList .tab-header.active {
					border-color: ${styles.titleActiveBorder};
					border-style: solid;
					color: ${styles.titleActiveForeground}
				}`);

				content.push(`.tabbedPanel.horizontal > .title .tabList .tab-header:focus,
					.tabbedPanel.horizontal > .title .tabList .tab-header.active {;
					border-width: 0 0 ${styles.activeTabContrastBorder ? '0' : '2'}px 0;
				}`);

				content.push(`.tabbedPanel.horizontal > .title .tabList .tab-header:hover {
					color: ${styles.titleActiveForeground}
				}`);
			}

			if (styles.activeBackgroundForVerticalLayout) {
				content.push(`.tabbedPanel.vertical > .title .tabList .tab-header.active {
					background-color:${styles.activeBackgroundForVerticalLayout}
				}`);
			}

			if (styles.border) {
				content.push(`.tabbedPanel.vertical > .title > .tabContainer {
					border-right-width: 1px;
					border-right-style: solid;
					border-right-color: ${styles.border};
				}

				.tabbedPanel .tab-group-header {
					border-color: ${styles.border};
				}`);
			}

			if (styles.activeTabContrastBorder) {
				content.push(`
				.tabbedPanel > .title .tabList .tab-header.active {
					outline: 1px solid;
					outline-offset: -3px;
					outline-color: ${styles.activeTabContrastBorder};
				}
			`);
			} else {
				content.push(`.tabbedPanel.horizontal > .title .tabList .tab-header:focus {
					outline-width: 0px;
				}`);
			}

			const newStyles = content.join('\n');
			if (newStyles !== this._styleElement.innerHTML) {
				this._styleElement.innerHTML = newStyles;
			}
		}
	}

}
