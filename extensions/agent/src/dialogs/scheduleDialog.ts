/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { ScheduleData } from '../data/scheduleData';

const localize = nls.loadMessageBundle();

export class ScheduleDialog {

	// Top level
	private readonly DialogTitle: string = localize('scheduleDialog.newSchedule', 'New Schedule');
	private readonly OkButtonText: string = localize('scheduleDialog.ok', 'OK');
	private readonly CancelButtonText: string = localize('scheduleDialog.cancel', 'Cancel');
	private readonly ScheduleNameText: string = localize('scheduleDialog.scheduleName', 'Schedule Name');
	private readonly SchedulesLabelText: string = localize('scheduleDialog.schedules', 'Schedules');

	// UI Components
	private dialog: sqlops.window.Dialog;
	private schedulesTable: sqlops.TableComponent;

	private model: ScheduleData;

	private _onSuccess: vscode.EventEmitter<ScheduleData> = new vscode.EventEmitter<ScheduleData>();
	public readonly onSuccess: vscode.Event<ScheduleData> = this._onSuccess.event;

	constructor(ownerUri: string) {
		this.model = new ScheduleData(ownerUri);
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.createModelViewDialog(this.DialogTitle);
		this.initializeContent();
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		sqlops.window.openDialog(this.dialog);
	}

	private initializeContent() {
		this.dialog.registerContent(async view => {
			this.schedulesTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						this.ScheduleNameText
					],
					data: [],
					height: 600,
					width: 400
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.schedulesTable,
					title: this.SchedulesLabelText
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			if (this.model.schedules) {
				let data: any[][] = [];
				for (let i = 0; i < this.model.schedules.length; ++i) {
					let schedule = this.model.schedules[i];
					data[i] = [ schedule.name ];
				}
				this.schedulesTable.data = data;
			}
		});
	}

	private async execute() {
		this.updateModel();
		await this.model.save();
		this._onSuccess.fire(this.model);
	}

	private async cancel() {
	}

	private updateModel() {
		let selectedRows = this.schedulesTable.selectedRows;
		if (selectedRows && selectedRows.length > 0) {
			let selectedRow = selectedRows[0];
			this.model.selectedSchedule = this.model.schedules[selectedRow];
		}
	}
}