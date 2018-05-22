/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!../media/availabilitygroup';
import 'vs/css!sql/parts/grid/media/slickColorTheme';

import * as nls from 'vs/nls';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, Injectable, OnInit } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IAvailabilityGroupService } from 'sql/parts/availabilityGroup/common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as sqlops from 'sqlops';
import { equals } from 'vs/base/common/objects';
import { BootstrapService } from '../../../services/bootstrap/bootstrapServiceImpl';
import { Observable } from 'rxjs/Observable';

export const AvailabilityGroupView_SELECTOR: string = 'availabilitygroupview-component';

@Component({
	selector: AvailabilityGroupView_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./availabilityGroupDashboard.component.html'))
})
@Injectable()
export class AvailabilityGroupDashboardComponent implements OnInit {
	private _availabilityGroupService: IAvailabilityGroupService;
	private _refresh: boolean = undefined;
	private Title: string = nls.localize('agDashboard.AvailabilityGroups', "Availability Groups");
	private AvailabilityGroups: sqlops.AvailabilityGroup[];

	ngOnInit(): void {
		let ags: sqlops.AvailabilityGroup[] = [];
		let i: number = 0;
		for (i = 0; i < 100; i++) {
			// tslint:disable-next-line:no-unexternalized-strings
			ags.push({ name: "Availability Group " + i, clusterType: "WSFC" });
		}
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;

		this._availabilityGroupService.getAvailabilityGroups(ownerUri).then((result)=>{
			this.AvailabilityGroups = result.availabilityGroups;
		});
	}

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef) {
		this._availabilityGroupService = this.bootstrapService.availabilityGroupService;
	}

	public get refresh(): boolean {
		return this._refresh;
	}

	public set refresh(value: boolean) {
		this._refresh = value;
		this._cd.detectChanges();
	}

	protected showDetail(agIndex: number) {

	}

	protected handleKeyboardEvents(event: KeyboardEvent, agIndex: number) {
		let kbEvent = new StandardKeyboardEvent(event);
		if (kbEvent.keyCode === KeyCode.Enter) {
			this.showDetail(agIndex);
			event.stopPropagation();
		}
	}
}
