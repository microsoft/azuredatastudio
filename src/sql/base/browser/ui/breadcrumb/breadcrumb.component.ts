/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/breadcrumb';

import { Component, Inject, forwardRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';

import { toDisposableSubscription } from 'sql/parts/common/rxjsUtils';
import { IBreadcrumbService, MenuItem, RouterOption } from './interfaces';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { IDisposable } from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';

@Component({
	selector: 'breadcrumb',
	template: `
				<span style="display: flex; flex-flow: row; align-items: center; margin: 10px">
					<ng-template ngFor let-item let-first="first" let-last="last" [ngForOf]="menuItems">
						<span #itemEle style="padding: 5px; display: flex; align-items: center">
							<span *ngIf="item.icon" class="icon" style="display: inline-block; margin-right: 5px" [ngClass]="item.icon"></span>
							<span *ngIf="first && item.label" style="font-weight: 200">{{item.label}}</span>
							<span *ngIf="last && item.label" style="">{{item.label}}</span>
							<a class="router-link" *ngIf="!last && !first && item.routerLink" (click)="route(item.routerLink)" style=" font-weight: 200" >{{item.label}}</a>
							<span class="icon chevron-right" (click)="contextMenu(item, itemEle)"></span>
						</span>
						<span *ngIf="!last" class="icon chevron-right"></span>
					</ng-template>
				</span>
				`
})
export class BreadcrumbComponent extends AngularDisposable implements OnInit {
	private menuItems: MenuItem[] = [];

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private _breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IThemeService) private themeService: IThemeService
	) {
		super();
	}

	ngOnInit() {
		this._register(toDisposableSubscription(this._breadcrumbService.breadcrumbItem.subscribe((item) => this.updateCrumb(item))));
	}

	private updateCrumb(items: MenuItem[]) {
		this.menuItems = items;
		this._changeRef.detectChanges();
	}

	public route(link: any[]): void {
		this._router.navigate(link);
	}

	public contextMenu(item: MenuItem, ele: HTMLElement): void {
		this.contextViewService.showContextView({
			getAnchor: () => ele,
			render: (container) => {
				let listele = document.createElement('div');
				container.appendChild(listele);
				listele.style.width = ele.offsetWidth + 'px';
				listele.style.height = '500px';
				let list = new List<RouterOption>(listele, {
					getHeight: () => 22,
					getTemplateId: () => 'id'
				}, [{
					templateId: 'id',
					renderElement: (element: RouterOption, index, template: HTMLElement) => {
						template.innerText = element.label;
					},
					renderTemplate: container => {
						const ele = document.createElement('div');
						container.appendChild(ele);
						return ele;
					},
					disposeTemplate: () => { }
				}]);
				attachListStyler(list, this.themeService);
				list.splice(0, list.length, item.routeOptions);

				return {
					dispose: () => {

					}
				};
			}
		});
	}
}
