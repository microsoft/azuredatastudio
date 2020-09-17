/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { ServiceOption } from 'azdata';
import { NotebookViewExtension, INotebookView } from 'sql/workbench/services/notebook/browser/models/notebookView';

export class OptionsModal {
	private _backupDialog: OptionsDialog;

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) { }

	public open(context: NotebookViewExtension) {

		const view = context.getActiveView();
		const backupOptions = this.getOptions();
		const optionValues: { [optionName: string]: any } = {
			name: view?.name
		};

		this._backupDialog = this.instantiationService ? this.instantiationService.createInstance(
			OptionsDialog, 'Configure View', 'ViewOptions', undefined) : undefined;

		this._backupDialog.render();
		this._backupDialog.open(backupOptions, optionValues);
		this._backupDialog.onOk(() => this.onOk(context));
	}

	private onOk(context: NotebookViewExtension) {
		const values = this._backupDialog.optionValues;

		const view: INotebookView = context.getActiveView();
		view.name = values.name;

		view.save();
	}

	private getOptions(): ServiceOption[] {
		return [{
			name: 'name',
			displayName: 'Name',
			description: 'Name for the view',
			groupName: undefined,
			valueType: ServiceOptionType.string,
			defaultValue: '',
			objectType: undefined,
			categoryValues: [],
			isRequired: false,
			isArray: undefined,
		}];
	}
}
