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
	private LoadingText: string = nls.localize('agDashboard.LoadingText', "Loading...");
	private ReplicasText: string = nls.localize('agDashboard.ReplicasText', "Replicas");
	private DatabasesText: string = nls.localize('agDashboard.DatabasesText', "Databases");
	private ClusterTypeLabel: string = nls.localize('agDashboard.ClusterTypeLabel', "Cluster Type");
	private BasicAvailabilityGroupLabel: string = nls.localize('agDashboard.BasicAvailabilityGroupLabel', "Is Basic Availability Group");
	private DTCSupportedEnabledLabel: string = nls.localize('agDashboard.DTCSupportedEnabledLabel', "Per Database DTC Support Enabled");
	private DatabaseHealthTriggerLabel: string = nls.localize('agDashboard.DatabaseHealthTriggerLabel', "Database Level Health Detection");
	private RequiredSynchronizedSecondariesToCommitLabel: string = nls.localize('agDashboard.RequiredSynchronizedSecondariesToCommitLabel', "Required Synchronized Secondaries To Commit");
	private LoadingCompleted: boolean = false;
	private AvailabilityGroups: sqlops.AvailabilityGroup[] = [];
	private CurrentAvailabilityGroup: sqlops.AvailabilityGroup;
	private ServerInstanceText: string = nls.localize('agDashboard.ServerInstanceText', "Server Instance");
	private RoleText: string = nls.localize('agDashboard.RoleText', "Role");
	private StateText: string = nls.localize('agDashboard.StateText', "State");
	private AvailabilityModeText: string = nls.localize('agDashboard.AvailabilityModeText', "Availability Mode");
	private FailoverModeText: string = nls.localize('agDashboard.FailoverModeText', "Failover Mode");
	private ConnectionsInPrimaryRoleText: string = nls.localize('agDashboard.ConnectionsInPrimaryRoleText', "Connections In Primary Role");
	private ReadableSecondaryText: string = nls.localize('agDashboard.ReadableSecondaryText', "Readable Secondary");
	private SeedingModeText: string = nls.localize('agDashboard.SeedingModeText', "Seeding Mode");
	private SessionTimeoutInSecondsText: string = nls.localize('agDashboard.SessionTimeoutInSecondsText', "Session Timeout(seconds)");
	private EndpointUrlText: string = nls.localize('agDashboard.EndpointUrlText', "Endpoint URL");
	private GeneralText: string = nls.localize('agDashboard.GeneralText', "General");
	private DatabaseText: string = nls.localize('agDashboard.DatabaseText', "Name");
	private IsJoinedText: string = nls.localize('agDashboard.IsJoinedText', "Joined");
	private IsSuspendedText: string = nls.localize('agDashboard.IsSuspendedText', "Suspended");
	private LocalReplicaRoleText: string = nls.localize('agDashboard.LocalReplicaRoleText', "Local Replica Role");
	private ColonText: string = nls.localize('agDashboard.ColonText', ":");

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		showTabsWhenOne: true,
		layout: NavigationBarLayout.vertical,
		showIcon: false,
	};

	ngOnInit(): void {
		this.getAvailabilityGroups();
	}

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef) {
		this._availabilityGroupService = this.bootstrapService.availabilityGroupService;
	}

	public get refresh(): boolean {
		return this._refresh;
	}

	public set refresh(value: boolean) {
		this._refresh = value;
		if (this._refresh && this.LoadingCompleted) {
			this.getAvailabilityGroups();
		}
		this._cd.detectChanges();
	}

	private getAvailabilityGroups() {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		let _self = this;
		this.LoadingCompleted = false;
		this._availabilityGroupService.getAvailabilityGroups(ownerUri).then((result) => {
			_self.LoadingCompleted = true;
			_self.AvailabilityGroups = result.availabilityGroups;
			if (result.availabilityGroups.length > 0) {
				_self.CurrentAvailabilityGroup = result.availabilityGroups[0];
			}
			_self._cd.detectChanges();
		});
	}

	protected showDetail(availabilitygroup: sqlops.AvailabilityGroup) {
		if (availabilitygroup) {
			this.CurrentAvailabilityGroup = availabilitygroup;
		}

		this._cd.detectChanges();
	}

	protected handleKeyboardEvents(event: KeyboardEvent, availabilitygroup: sqlops.AvailabilityGroup) {
		let kbEvent = new StandardKeyboardEvent(event);
		if (kbEvent.keyCode === KeyCode.Enter) {
			this.showDetail(availabilitygroup);
			event.stopPropagation();
		}
	}

	private getReplicaStateImageClass(replica: sqlops.AvailabilityReplica) {
		switch (replica.stateValue) {
			case 0:
				return "availability-replica-diconnected";
			case 1:
				return "availability-replica-connected";
			default:
				return "availability-replica-unknown";
		}
	}

	private getDatabaseStateImageClass(database: sqlops.AvailabilityDatabase) {
		if (database.isJoined && !database.isSuspended && (database.stateValue === 0 || database.stateValue === 3 || database.stateValue === 4)) {
			return "availability-database-not-synchronizing";
		} else if (database.isJoined && !database.isSuspended && (database.stateValue === 1 || database.stateValue === 2)) {
			return "availability-database-synchronizing";
		} else if (database.isJoined && database.isSuspended) {
			return "availability-database-suspended";
		} else if (!database.isJoined) {
			return "availability-database-not-joined";
		} else {
			return "availability-database-unknown";
		}
	}
}