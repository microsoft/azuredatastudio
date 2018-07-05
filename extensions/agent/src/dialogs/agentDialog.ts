/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { IAgentDialogData } from '../interfaces';

const localize = nls.loadMessageBundle();

export abstract class AgentDialog<T extends IAgentDialogData> {

	private static readonly OkButtonText: string = localize('createAlert.OK', 'OK');
	private static readonly CancelButtonText: string = localize('createAlert.Cancel', 'Cancel');

	protected _onSuccess: vscode.EventEmitter<T> = new vscode.EventEmitter<T>();
	public readonly onSuccess: vscode.Event<T> = this._onSuccess.event;
	public dialog: sqlops.window.modelviewdialog.Dialog;

	constructor(public ownerUri: string, public model: T, public title: string) {
	}

	protected abstract async updateModel();

	protected abstract async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog);

	public async openDialog() {
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.title);

		await this.model.initialize();

		await this.initializeDialog(this.dialog);

		this.dialog.okButton.label = AgentDialog.OkButtonText;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = AgentDialog.CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	protected async execute() {
		this.updateModel();
		let success = await this.model.save();
		if (success) {
			this._onSuccess.fire(this.model);
		}
	}

	protected async cancel() {
	}

	protected getActualConditionValue(checkbox: sqlops.CheckBoxComponent, dropdown: sqlops.DropDownComponent): sqlops.JobCompletionActionCondition {
		return checkbox.checked ? Number(this.getDropdownValue(dropdown)) : sqlops.JobCompletionActionCondition.Never;
	}

	protected getDropdownValue(dropdown: sqlops.DropDownComponent): string {
		return (typeof dropdown.value === 'string') ? dropdown.value : dropdown.value.name;
	}

	protected setConditionDropdownSelectedValue(dropdown: sqlops.DropDownComponent, selectedValue: number) {
		let idx: number = 0;
		for (idx = 0; idx < dropdown.values.length; idx++) {
			if (Number((<sqlops.CategoryValue>dropdown.values[idx]).name) === selectedValue) {
				dropdown.value = dropdown.values[idx];
				break;
			}
		}
	}
}