/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboard';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import * as Utils from 'sql/platform/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { AngularDisposable } from 'sql/base/node/lifecycle';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';

export const DASHBOARD_SELECTOR: string = 'dashboard-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./dashboard.component.html'))
})
export class DashboardComponent extends AngularDisposable implements OnInit {
	private _currentPage: DashboardPage;

	@ViewChild('header', { read: ElementRef }) private header: ElementRef;
	@ViewChild('actionBar', { read: ElementRef }) private actionbarContainer: ElementRef;
	private actionbar: ActionBar;
	private editAction: EditDashboardAction;
	private editDisposable: IDisposable;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
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
