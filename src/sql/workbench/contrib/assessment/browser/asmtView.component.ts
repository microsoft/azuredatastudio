/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/asmt';
import { Component, Inject, forwardRef, ChangeDetectorRef, ViewChild, Injectable, OnInit } from '@angular/core';
import { ServerInfo } from 'azdata';
//import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { AsmtResultsViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtResultsView.component';
import { LocalizedStrings } from 'sql/workbench/contrib/assessment/common/strings';



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
		this.instanceName = serverName;
	}

	public displayAssessmentInfo(apiVersion: string, rulesetVersion: string) {
		this.api = apiVersion;
		this.ruleset = rulesetVersion;
		this._cd.detectChanges();
	}

	public layout() {
		if (this._asmtResultView.layout !== undefined) {
			this._asmtResultView.layout();
		}

		//this._panel.layout();
	}
}
