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
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { selectListBackground, selectBackground, selectBorder } from 'vs/platform/theme/common/colorRegistry';

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
	private listContainer: HTMLElement;
	private list: List<RouterOption>;

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
		this.listContainer = document.createElement('div');
		this.listContainer.style.outlineWidth = '1px';
		this.listContainer.style.outlineStyle = 'solid';
		this.list = new List<RouterOption>(this.listContainer, {
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
		this._register(attachListStyler(this.list, this.themeService));
		this._register(this.themeService.onThemeChange(this.style, this));
		this.style(this.themeService.getTheme());
	}

	private updateCrumb(items: MenuItem[]) {
		this.menuItems = items;
		this._changeRef.detectChanges();
	}

	public route(link: any[]): void {
		this._router.navigate(link);
	}

	private style(e: ITheme): void {
		this.listContainer.style.backgroundColor = e.getColor(selectBackground).toString();
		this.listContainer.style.outlineColor = e.getColor(selectBorder).toString();
	}

	public contextMenu(item: MenuItem, ele: HTMLElement): void {
		this.contextViewService.showContextView({
			getAnchor: () => ele,
			render: container => {
				container.appendChild(this.listContainer);
				this.listContainer.style.width = ele.offsetWidth + 'px';
				this.listContainer.style.height = '200px';
				this.list.splice(0, this.list.length, item.routeOptions);
				this.list.layout();

				return { dispose: () => {}};
			}
		});
	}
}
