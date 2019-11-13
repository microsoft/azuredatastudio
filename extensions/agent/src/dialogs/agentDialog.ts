/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

const localize = nls.loadMessageBundle();

export abstract class AgentDialog<T extends IAgentDialogData> {

	private static readonly OkButtonText: string = localize('agentDialog.OK', "OK");
	private static readonly CancelButtonText: string = localize('agentDialog.Cancel', "Cancel");

	protected _onSuccess: vscode.EventEmitter<T> = new vscode.EventEmitter<T>();
	protected _isOpen: boolean = false;
	public readonly onSuccess: vscode.Event<T> = this._onSuccess.event;
	public dialog: azdata.window.Dialog;

	// Dialog Name for Telemetry
	public dialogName: string;

	constructor(public ownerUri: string, public model: T, public title: string) {
	}

	public get dialogMode(): AgentDialogMode {
		return this.model.dialogMode;
	}

	protected abstract async updateModel(): Promise<void>;

	protected abstract async initializeDialog(dialog: azdata.window.Dialog): Promise<void>;

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			let event = dialogName ? dialogName : null;
			this.dialog = azdata.window.createModelViewDialog(this.title, event);

			await this.model.initialize();

			await this.initializeDialog(this.dialog);

			this.dialog.okButton.label = AgentDialog.OkButtonText;
			this.dialog.okButton.onClick(async () => await this.execute());

			this.dialog.cancelButton.label = AgentDialog.CancelButtonText;
			this.dialog.cancelButton.onClick(async () => await this.cancel());

			azdata.window.openDialog(this.dialog);
		}
	}

	protected async execute() {
		this.updateModel();
		await this.model.save();
		this._isOpen = false;
		this._onSuccess.fire(this.model);
	}

	protected async cancel() {
		this._isOpen = false;
	}

	protected getActualConditionValue(checkbox: azdata.CheckBoxComponent, dropdown: azdata.DropDownComponent): azdata.JobCompletionActionCondition {
		return checkbox.checked ? Number(this.getDropdownValue(dropdown)) : azdata.JobCompletionActionCondition.Never;
	}

	protected getDropdownValue(dropdown: azdata.DropDownComponent): string {
		return (typeof dropdown.value === 'string') ? dropdown.value : dropdown.value.name;
	}

	protected setConditionDropdownSelectedValue(dropdown: azdata.DropDownComponent, selectedValue: number) {
		let idx: number = 0;
		for (idx = 0; idx < dropdown.values.length; idx++) {
			if (Number((<azdata.CategoryValue>dropdown.values[idx]).name) === selectedValue) {
				dropdown.value = dropdown.values[idx];
				break;
			}
		}
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
