/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Injectable, forwardRef, Inject, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs/Subject';

import { DashboardServiceInterface } from './dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { MenuItem, IBreadcrumbService, RouterOption } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';

export enum BreadcrumbClass {
	DatabasePage,
	ServerPage
}

@Injectable()
export class BreadcrumbService implements IBreadcrumbService {
	public breadcrumbItem: Subject<MenuItem[]>;
	private itemBreadcrums: MenuItem[];
	private _currentPage: BreadcrumbClass;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: DashboardServiceInterface
	) {
		this._bootstrap.onUpdatePage(() => {
			this.setBreadcrumbs(this._currentPage);
		});
		this.breadcrumbItem = new Subject<MenuItem[]>();
	}

	public setBreadcrumbs(page: BreadcrumbClass) {
		this._currentPage = page;
		this.itemBreadcrums = [];
		let refList: MenuItem[] = this.getBreadcrumbsLink(page);
		this.breadcrumbItem.next(refList);
	}

	private getBreadcrumbsLink(page: BreadcrumbClass): MenuItem[] {
		this.itemBreadcrums = [];
		let profile = this._bootstrap.connectionManagementService.connectionInfo.connectionProfile;
		this.itemBreadcrums.push({ label: nls.localize('homeCrumb', 'Home') });
		switch (page) {
			case BreadcrumbClass.DatabasePage:
				this.itemBreadcrums.push(this.getServerBreadcrumb(profile));
				this.itemBreadcrums.push(this.getDbBreadcrumb(profile));
				break;
			case BreadcrumbClass.ServerPage:
				this.itemBreadcrums.push(this.getServerBreadcrumb(profile));
				break;
			default:
				this.itemBreadcrums = [];
		}
		return this.itemBreadcrums;
	}

	private getServerBreadcrumb(profile: ConnectionProfile): MenuItem {
		return { label: profile.serverName, routerLink: [profile.serverName] };
	}

	private getDbBreadcrumb(profile: ConnectionProfile): MenuItem {
		let ret: MenuItem = {
			label: profile.databaseName,
			routerLink: [`${profile.serverName}/${profile.databaseName}`]
		};
		this._bootstrap.metadataService.databaseNames.subscribe(e => {
			ret.routeOptions = e.map(e => {
				return <RouterOption> {
					label: e,
				};
			});
		});
		return ret;
	}
}
