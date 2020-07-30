/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/asmt';
import { Component, Inject, forwardRef, ChangeDetectorRef, Injectable, OnInit } from '@angular/core';
import { ServerInfo } from 'azdata';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { LocalizedStrings } from 'sql/workbench/contrib/assessment/common/strings';

export const DASHBOARD_SELECTOR: string = 'asmtview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./asmtView.component.html'))
})
@Injectable()
export class AsmtViewComponent extends AngularDisposable implements OnInit {

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
}
