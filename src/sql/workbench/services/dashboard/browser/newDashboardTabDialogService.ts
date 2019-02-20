/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { INewDashboardTabDialogService } from 'sql/workbench/services/dashboard/common/newDashboardTabDialog';
import { NewDashboardTabDialog } from 'sql/workbench/services/dashboard/browser/newDashboardTabDialog';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { IAngularEventingService, AngularEventType } from 'sql/platform/angularEventing/common/angularEventingService';
import { IDashboardUITab } from 'sql/workbench/services/dashboard/common/newDashboardTabViewModel';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class NewDashboardTabDialogService implements INewDashboardTabDialogService {
	_serviceBrand: any;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _addNewTabDialog: NewDashboardTabDialog;
	private _uri: string;

	constructor(
		@IAngularEventingService private _angularEventService: IAngularEventingService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) { }

	/**
	 * Open account dialog
	 */
	public showDialog(dashboardTabs: Array<IDashboardTab>, openedTabs: Array<IDashboardTab>, uri: string): void {
		this._uri = uri;
		let self = this;

		// Create a new dialog if one doesn't exist
		if (!this._addNewTabDialog) {
			this._addNewTabDialog = this._instantiationService.createInstance(NewDashboardTabDialog);
			this._addNewTabDialog.onCancel(() => { self.handleOnCancel(); });
			this._addNewTabDialog.onAddTabs((selectedTabs) => { self.handleOnAddTabs(selectedTabs); });
			this._addNewTabDialog.render();
		}

		// Open the dialog
		this._addNewTabDialog.open(dashboardTabs, openedTabs);
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private handleOnAddTabs(selectedUiTabs: Array<IDashboardUITab>): void {
		let selectedTabs = selectedUiTabs.map(tab => tab.tabConfig);
		this._angularEventService.sendAngularEvent(this._uri, AngularEventType.NEW_TABS, { dashboardTabs: selectedTabs });
		this._addNewTabDialog.close();
	}

	private handleOnCancel(): void { }
}
