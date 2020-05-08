/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tabHeader';

import { Component, AfterContentInit, OnDestroy, Input, Output, ElementRef, ViewChild, EventEmitter, ChangeDetectorRef, forwardRef, Inject } from '@angular/core';

import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';

import { TabComponent } from './tab.component';
import { CloseTabAction } from 'sql/base/browser/ui/panel/tabActions';

@Component({
	selector: 'tab-header',
	template: `
		<div #actionHeader role="tab" [attr.aria-selected]="tab.active" [attr.aria-label]="tab.title" class="tab-header" style="flex: 0 0; flex-direction: row;" [class.active]="tab.active" tabindex="0" (click)="selectTab(tab)" (keyup)="onKey($event)">
			<div class="tab" role="presentation">
				<a #tabIcon *ngIf="showIcon && tab.iconClass" class="tabIcon codicon icon {{tab.iconClass}}"></a>
				<a class="tabLabel" [class.active]="tab.active" [title]="tab.title" #tabLabel>{{tab.title}}</a>
			</div>
			<div #actionbar style="flex: 0 0 auto; align-self: end; margin-top: auto; margin-bottom: auto;" ></div>
		</div>
	`
})
export class TabHeaderComponent extends Disposable implements AfterContentInit, OnDestroy {
	@Input() public tab!: TabComponent;
	@Input() public showIcon?: boolean;
	@Input() public active?: boolean;
	@Output() public onSelectTab: EventEmitter<TabComponent> = new EventEmitter<TabComponent>();
	@Output() public onCloseTab: EventEmitter<TabComponent> = new EventEmitter<TabComponent>();
	@Output() public onFocusTab: EventEmitter<TabComponent> = new EventEmitter<TabComponent>();

	private _actionbar!: ActionBar;

	@ViewChild('actionHeader', { read: ElementRef }) private _actionHeaderRef!: ElementRef;
	@ViewChild('actionbar', { read: ElementRef }) private _actionbarRef!: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef
	) {
		super();
	}

	public get nativeElement(): HTMLElement {
		return this._actionHeaderRef.nativeElement;
	}

	public refresh(): void {
		this._cd.detectChanges();
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
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				this.onSelectTab.emit(this.tab);
				e.stopPropagation();
			}
		}
	}
}
