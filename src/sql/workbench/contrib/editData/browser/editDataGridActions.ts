/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGridInfo } from 'sql/workbench/contrib/grid/browser/interfaces';
import { DataService } from 'sql/workbench/services/query/common/dataService';
import { GridActionProvider } from 'sql/workbench/contrib/editData/browser/gridActions';
import { localize } from 'vs/nls';
import { IAction, Action } from 'vs/base/common/actions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class EditDataGridActionProvider extends GridActionProvider {

	constructor(
		dataService: DataService,
		selectAllCallback: (index: number) => void,
		private _deleteRowCallback: (index: number) => void,
		private _revertRowCallback: () => void,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(dataService, selectAllCallback, instantiationService, configurationService);
	}
	/**
	 * Return actions given a click on an edit data grid
	 */
	public override getGridActions(): IAction[] {
		let actions: IAction[] = [];
		actions.push(new DeleteRowAction(DeleteRowAction.ID, DeleteRowAction.LABEL, this._deleteRowCallback));
		actions.push(new RevertRowAction(RevertRowAction.ID, RevertRowAction.LABEL, this._revertRowCallback));

		return actions;
	}
}

export class DeleteRowAction extends Action {
	public static ID = 'grid.deleteRow';
	public static LABEL = localize('deleteRow', "Delete Row");

	constructor(
		id: string,
		label: string,
		private callback: (index: number) => void
	) {
		super(id, label);
	}

	public override async run(gridInfo: IGridInfo): Promise<void> {
		this.callback(gridInfo.rowIndex);
	}
}

export class RevertRowAction extends Action {
	public static ID = 'grid.revertRow';
	public static LABEL = localize('revertRow', "Revert Current Row");

	constructor(
		id: string,
		label: string,
		private callback: () => void
	) {
		super(id, label);
	}

	public override async run(gridInfo: IGridInfo): Promise<void> {
		this.callback();
	}
}
