/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./tabHeader';

import { Component, AfterContentInit, OnDestroy, Input, Output, ElementRef, ViewChild, EventEmitter } from '@angular/core';

import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';

import { TabComponent } from './tab.component';
import { CloseTabAction } from './tabActions';

@Component({
	selector: 'tab-header',
	template: `
		<div #actionHeader role="presentation" class="tab-header" style="flex: 0 0; flex-direction: row; height: 100%" [class.active]="tab.active" tabindex="0" (keyup)="onKey($event)">
			<span class="tab" (click)="selectTab(tab)" role="tab" [attr.aria-selected]="tab.active" [attr.aria-controls]="tab.title">
				<a class="tabLabel" [class.active]="tab.active" #tabLabel>
				</a>
			</span>
			<span #actionbar style="flex: 0 0 auto; align-self: end; margin-top: auto; margin-bottom: auto;" ></span>
		</div>
	`
})
export class TabHeaderComponent extends Disposable implements AfterContentInit, OnDestroy {
	@Input() public tab: TabComponent;
	@Input() public showIcon: boolean;
	@Input() public active: boolean;
	@Output() public onSelectTab: EventEmitter<TabComponent> = new EventEmitter<TabComponent>();
	@Output() public onCloseTab: EventEmitter<TabComponent> = new EventEmitter<TabComponent>();

	private _actionbar: ActionBar;

	@ViewChild('actionHeader', { read: ElementRef }) private _actionHeaderRef: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef: ElementRef;
	@ViewChild('tabLabel', { read: ElementRef }) private _tabLabelRef: ElementRef;
	constructor() {
		super();
	}

	ngAfterContentInit(): void {
		if (this.tab.canClose || this.tab.actions) {
			this._actionbar = new ActionBar(this._actionbarRef.nativeElement);
			if (this.tab.actions) {
				this._actionbar.push(this.tab.actions, { icon: true, label: false });
			}
			if (this.tab.canClose) {
				let closeAction = this._register(new CloseTabAction(this.closeTab, this));
				this._actionbar.push(closeAction, { icon: true, label: false });
			}
		}

		let tabLabelcontainer = this._tabLabelRef.nativeElement as HTMLElement;
		if (this.showIcon && this.tab.iconClass) {
			tabLabelcontainer.className = 'tabLabel icon';
			tabLabelcontainer.classList.add(this.tab.iconClass);
		} else {
			tabLabelcontainer.className = 'tabLabel';
			tabLabelcontainer.textContent = this.tab.title;
		}
		tabLabelcontainer.title = this.tab.title;
	}

	ngOnDestroy() {
		if (this._actionbar) {
			this._actionbar.dispose();
		}
		this.dispose();
	}

	selectTab(tab: TabComponent) {
		this.onSelectTab.emit(tab);
	}

	closeTab() {
		this.onCloseTab.emit(this.tab);
	}

	focusOnTabHeader() {
		let header = <HTMLElement>this._actionHeaderRef.nativeElement;
		header.focus();
	}

	onKey(e: Event) {
		if (DOM.isAncestor(<HTMLElement>e.target, this._actionHeaderRef.nativeElement) && e instanceof KeyboardEvent) {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.onSelectTab.emit(this.tab);
				e.stopPropagation();
			}
		}
	}
}
