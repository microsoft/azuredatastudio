/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/breadcrumb';

import { Component, Inject, forwardRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';

import { IBreadcrumbService, MenuItem } from './interfaces';

import { IDisposable } from 'vs/base/common/lifecycle';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';

@Component({
	selector: 'breadcrumb',
	template: `
				<span class="breadcrumb-container">
					<ng-template ngFor let-item let-first="first" let-last="last" [ngForOf]="menuItems">
						<span style="padding: 5px; display: flex; align-items: center">
							<span *ngIf="item.icon" class="codicon" style="display: inline-block; margin-right: 5px" [ngClass]="item.icon"></span>
							<span *ngIf="first">{{item.label}}</span>
							<span *ngIf="last" style="">{{item.label}}</span>
							<a class="router-link" *ngIf="!last && !first" (click)="route(item.routerLink)" >{{item.label}}</a>
						</span>
						<span *ngIf="!last" class="codicon chevron-right"></span>
					</ng-template>
				</span>
				`
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
	protected menuItems: MenuItem[] = []; // used by angular template
	private disposables: Array<IDisposable> = new Array();

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private _breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) { }

	ngOnInit() {
		this.disposables.push(subscriptionToDisposable(this._breadcrumbService.breadcrumbItem.subscribe((item) => this.updateCrumb(item))));
	}

	ngOnDestroy() {
		this.disposables.forEach(item => item.dispose());
	}

	private updateCrumb(items: MenuItem[]) {
		this.menuItems = items;
		this._changeRef.detectChanges();
	}

	public route(link: any[]): Promise<boolean> {
		return this._router.navigate(link);
	}
}
