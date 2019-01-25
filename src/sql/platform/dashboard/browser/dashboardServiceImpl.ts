/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IDashboardService } from './dashboardService';
import { Event, Emitter } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import * as sqlops from 'sqlops';

export class DashboardService implements IDashboardService {
	public _serviceBrand: any;
	private _onDidOpenDashboard = new Emitter<sqlops.DashboardDocument>();
	public readonly onDidOpenDashboard: Event<sqlops.DashboardDocument> = this._onDidOpenDashboard.event;

	private _onDidChangeToDashboard = new Emitter<sqlops.DashboardDocument>();
	public readonly onDidChangeToDashboard: Event<sqlops.DashboardDocument> = this._onDidChangeToDashboard.event;

	private _onLayout = new Emitter<DOM.Dimension>();
	public readonly onLayout: Event<DOM.Dimension> = this._onLayout.event;

	public openDashboard(document: sqlops.DashboardDocument): void {
		this._onDidOpenDashboard.fire(document);
	}

	public changeToDashboard(document: sqlops.DashboardDocument): void {
		this._onDidChangeToDashboard.fire(document);
	}

	public layout(dimension: DOM.Dimension): void {
		this._onLayout.fire(dimension);
	}
}
