/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Inject, forwardRef, ChangeDetectorRef, Injectable, OnInit, ViewChild, ElementRef } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { localize } from 'vs/nls';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { ServerInfo } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { GetDiagramModelAction } from 'sql/workbench/contrib/diagrams/browser/diagramActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Action } from 'vs/base/common/actions';

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

export const DASHBOARD_SELECTOR: string = 'diagram-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./diagram.component.html'))
})

@Injectable()
export class DiagramComponent extends AngularDisposable implements OnInit {

	protected localizedStrings = LocalizedStrings;
	connectionInfo: ServerInfo = null;
	instanceName: string = '';
	protected _actionBar: Taskbar;

	@ViewChild('diagramActionbarContainer') protected actionBarContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService
	) {
		super();
	}

	ngOnInit() {
		this.displayConnectionInfo();
		this.initActionBar();
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
		this._cd.detectChanges();
	}

	private initActionBar(): void {
		const getModelAction: Action = this._instantiationService.createInstance(GetDiagramModelAction,
			GetDiagramModelAction.ID, GetDiagramModelAction.LABEL);
		const taskbar: HTMLElement = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.setContent([
			{ action: getModelAction },
		]);
		this._actionBar.context = this._commonService.connectionManagementService.connectionInfo.ownerUri;
	}

	public layout() {
		//this._panel.layout();
	}
}


