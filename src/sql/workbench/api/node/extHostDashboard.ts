/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';

import * as sqlops from 'sqlops';

import { ExtHostDashboardShape, MainThreadDashboardShape, SqlMainContext } from './sqlExtHost.protocol';

export class ExtHostDashboard implements ExtHostDashboardShape {
	private _onDidOpenDashboard = new Emitter<sqlops.DashboardDocument>();
	public readonly onDidOpenDashboard: Event<sqlops.DashboardDocument> = this._onDidOpenDashboard.event;

	private _onDidChangeToDashboard = new Emitter<sqlops.DashboardDocument>();
	public readonly onDidChangeToDashboard: Event<sqlops.DashboardDocument> = this._onDidChangeToDashboard.event;

	private _proxy: MainThreadDashboardShape;

	constructor(mainContext: IMainContext) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadDashboard);
	}

	$onDidOpenDashboard(dashboard: sqlops.DashboardDocument) {
		this._onDidOpenDashboard.fire(dashboard);
	}

	$onDidChangeToDashboard(dashboard: sqlops.DashboardDocument) {
		this._onDidChangeToDashboard.fire(dashboard);
	}
}
