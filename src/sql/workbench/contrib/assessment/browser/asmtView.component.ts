/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/asmt';
import { Component, Inject, forwardRef, ChangeDetectorRef, ViewChild, Injectable, OnInit } from '@angular/core';
import { ServerInfo } from 'azdata';
//import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { localize } from 'vs/nls';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { AsmtResultsViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtResultsView.component';


const LocalizedStrings = {
	SECTION_TITLE_API: localize('asmt.section.api.title', "API information"),
	API_VERSION: localize('asmt.apiversion', "API Version:"),
	DEFAULT_RULESET_VERSION: localize('asmt.rulesetversion', "Default Ruleset Version:"),
	SECTION_TITLE_SQL_SERVER: localize('asmt.section.instance.title', "SQL Server Instance Details"),
	SERVER_VERSION: localize('asmt.serverversion', "Version:"),
	SERVER_EDITION: localize('asmt.serveredition', "Edition:"),
	SERVER_INSTANCENAME: localize('asmt.instancename', "Instance Name:"),
	SERVER_OSVERSION: localize('asmt.osversion', "OS Version:")
};

export const DASHBOARD_SELECTOR: string = 'asmtview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./asmtView.component.html'))
})
@Injectable()
export class AsmtViewComponent extends AngularDisposable implements OnInit {

	@ViewChild('asmtresultcomponent') private _asmtResultView: AsmtResultsViewComponent;
	protected localizedStrings = LocalizedStrings;

	connectionInfo: ServerInfo = null;
	instanceName: string = '';
	ruleset: string = '';
	api: string = '';




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
		this._asmtResultView.layout();
		//this._panel.layout();
	}
}
