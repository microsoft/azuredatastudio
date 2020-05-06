/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { OnInit, Component, Inject, forwardRef, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import * as Utils from 'sql/platform/connection/common/utils';
import { DashboardPage } from 'sql/workbench/contrib/dashboard/browser/core/dashboardPage.component';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { IColorTheme } from 'vs/platform/theme/common/themeService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';

export const DASHBOARD_SELECTOR: string = 'dashboard-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./dashboard.component.html'))
})
export class DashboardComponent extends AngularDisposable implements OnInit {
	private _currentPage: DashboardPage;

	@ViewChild('header', { read: ElementRef }) private header: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		const profile: IConnectionProfile = this._bootstrapService.getOriginalConnectionProfile();
		if (profile && (!profile.databaseName || Utils.isMaster(profile))) {
			// Route to the server page as this is the default database
			this._router.navigate(['server-dashboard']).catch(onUnexpectedError);
		}
	}

	private updateTheme(theme: IColorTheme): void {
		const headerEl = <HTMLElement>this.header.nativeElement;
		const highContrastBorder = theme.getColor(contrastBorder);
		headerEl.style.borderBottomColor = highContrastBorder ? highContrastBorder.toString() : theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
		headerEl.style.borderBottomWidth = '1px';
		headerEl.style.borderBottomStyle = 'solid';
	}

	onActivate(page: DashboardPage) {
		this._currentPage = page;
	}

	refresh(): void {
		if (this._currentPage) {
			this._currentPage.refresh();
		}
	}
}
