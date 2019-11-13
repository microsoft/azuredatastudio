/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';

import * as azdata from 'azdata';

import { ExtHostDashboardShape } from './sqlExtHost.protocol';

export class ExtHostDashboard implements ExtHostDashboardShape {
	private _onDidOpenDashboard = new Emitter<azdata.DashboardDocument>();
	public readonly onDidOpenDashboard: Event<azdata.DashboardDocument> = this._onDidOpenDashboard.event;

	private _onDidChangeToDashboard = new Emitter<azdata.DashboardDocument>();
	public readonly onDidChangeToDashboard: Event<azdata.DashboardDocument> = this._onDidChangeToDashboard.event;

	constructor(mainContext: IMainContext) {
	}

	$onDidOpenDashboard(dashboard: azdata.DashboardDocument) {
		this._onDidOpenDashboard.fire(dashboard);
	}

	$onDidChangeToDashboard(dashboard: azdata.DashboardDocument) {
		this._onDidChangeToDashboard.fire(dashboard);
	}
}
