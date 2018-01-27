/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboard';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { DashboardServiceInterface } from './services/dashboardServiceInterface.service';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';

import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';

export const DASHBOARD_SELECTOR: string = 'dashboard-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./dashboard.component.html'))
})
export class DashboardComponent implements OnInit, OnDestroy {
	private _subs: Array<IDisposable> = new Array();
	private _currentPage: DashboardPage;

	@ViewChild('header', { read: ElementRef }) private header: ElementRef;
	@ViewChild('actionBar', { read: ElementRef }) private actionbarContainer: ElementRef;
	private actionbar: ActionBar;
	private editAction: EditDashboardAction;
	private editDisposable: IDisposable;

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) private _bootstrapService: DashboardServiceInterface,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) { }

	ngOnInit() {
		this._subs.push(this._bootstrapService.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this._bootstrapService.themeService.getColorTheme());
		let profile: IConnectionProfile = this._bootstrapService.getOriginalConnectionProfile();
		this.actionbar = new ActionBar(this.actionbarContainer.nativeElement);
		this.actionbar.push(new RefreshWidgetAction(this.refresh, this), {
			icon: true,
			label: false,
		});
		this.editAction = new EditDashboardAction(this.edit, this);
		this.actionbar.push(this.editAction, {
			icon: true,
			label: false,
		});
		if (profile && (!profile.databaseName || Utils.isMaster(profile))) {
			// Route to the server page as this is the default database
			this._router.navigate(['server-dashboard']);
		}
	}

	ngOnDestroy() {
		this._subs.forEach((value) => {
			value.dispose();
		});
	}

	private updateTheme(theme: IColorTheme): void {
		let headerEl = <HTMLElement>this.header.nativeElement;
		headerEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
		headerEl.style.borderBottomWidth = '1px';
		headerEl.style.borderBottomStyle = 'solid';
	}

	onActivate(page: DashboardPage) {
		if (this.editDisposable) {
			this.editDisposable.dispose();
		}
		this._currentPage = page;
		this.editDisposable = page.editEnabled(e => this.editEnabled = e, this);
	}

	refresh(): void {
		if (this._currentPage) {
			this._currentPage.refresh();
		}
	}

	edit(): void {
		this._currentPage.enableEdit();
	}

	set editEnabled(val: boolean) {
		this.editAction.enabled = val;
	}
}
