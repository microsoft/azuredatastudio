/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Input, ContentChild, OnDestroy, TemplateRef, ChangeDetectorRef, forwardRef, Inject } from '@angular/core';

import { Action } from 'vs/base/common/actions';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

export abstract class TabChild extends AngularDisposable {
	public abstract layout(): void;
}

export type TabType = 'tab' | 'group-header';

@Component({
	selector: 'tab',
	template: `
		<div role="tabpanel" [attr.aria-labelledby]="identifier" class="visibility" [class.hidden]="shouldBeHidden()" *ngIf="shouldBeIfed()" class="fullsize">
			<ng-container *ngTemplateOutlet="templateRef"></ng-container>
		</div>
	`
})
export class TabComponent implements OnDestroy {
	private _child?: TabChild;
	@ContentChild(TemplateRef) templateRef!: TemplateRef<any>;
	@Input() public title?: string;
	@Input() public canClose!: boolean;
	@Input() public actions?: Array<Action>;
	@Input() public iconClass?: string;
	private _selected = false;
	@Input() public identifier!: string;
	@Input() public type: TabType = 'tab';
	@Input() private visibilityType: 'if' | 'visibility' = 'if';
	private rendered = false;
	private destroyed: boolean = false;

	@ContentChild(TabChild) public set child(tab: TabChild) {
		this._child = tab;
		if (this.selected && this._child) {
			this._child.layout();
		}
	}

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef
	) { }

	public set selected(val: boolean) {
		if (!this.destroyed) {
			this._selected = val;
			if (this.selected) {
				this.rendered = true;
			}
			this._cd.detectChanges();
			if (this.selected && this._child) {
				this._child.layout();
			}
		}
	}

	public get selected(): boolean {
		return this._selected;
	}

	ngOnDestroy() {
		this.destroyed = true;
		if (this.actions && this.actions.length > 0) {
			this.actions.forEach((action) => action.dispose());
		}
	}

	shouldBeIfed(): boolean {
		if (this.selected) {
			return true;
		} else if (this.visibilityType === 'visibility' && this.rendered) {
			return true;
		} else {
			return false;
		}
	}

	shouldBeHidden(): boolean {
		if (this.visibilityType === 'visibility' && !this.selected) {
			return true;
		} else {
			return false;
		}
	}

	public layout() {
		if (this._child) {
			this._child.layout();
		}
	}
}
