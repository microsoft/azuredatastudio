/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/asmt';
import { Component, Inject, forwardRef, ChangeDetectorRef, ViewChild, Injectable, OnInit } from '@angular/core';
import { ServerInfo } from 'azdata';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';

export const DASHBOARD_SELECTOR: string = 'asmtview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./asmtView.component.html'))
})
@Injectable()
export class AsmtViewComponent extends AngularDisposable implements OnInit {

	@ViewChild(PanelComponent) private _panel: PanelComponent;

	connectionInfo: ServerInfo = null;
	instanceName: string = '';
	ruleset: string = '';
	api: string = '';


	public readonly panelOpt: IPanelOptions = {
		alwaysShowTabs: false,
		layout: NavigationBarLayout.vertical,
		showIcon: true
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface) {
		super();
	}

	ngOnInit() {
		this.displayConnectionInfo();
	}

	private displayConnectionInfo() {
		this.connectionInfo = this._commonService.connectionManagementService.connectionInfo.serverInfo;
		let serverName = this._commonService.connectionManagementService.connectionInfo.connectionProfile.serverName;
		let machineName = this.connectionInfo['machineName'];
		if ((['local', '(local)', '(local);'].indexOf(serverName.toLowerCase()) >= 0) || machineName.toLowerCase() === serverName.toLowerCase()) {
			this.instanceName = machineName;
		}
		else {
			this.instanceName = machineName + '\\' + serverName;
		}
	}

	public displayAssessmentInfo(apiVersion: string, rulesetVersion: string) {
		this.api = apiVersion;
		this.ruleset = rulesetVersion;
		this._cd.detectChanges();
	}

	public layout() {
		this._panel.layout();
	}
}
