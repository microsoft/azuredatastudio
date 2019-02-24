/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 'use strict';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { PickScheduleData } from '../data/pickScheduleData';

const localize = nls.loadMessageBundle();

export class PickScheduleDialog {

	// TODO: localize
	// Top level
	private readonly DialogTitle: string = localize('pickSchedule.jobSchedules', 'Job Schedules');
	private readonly OkButtonText: string = localize('pickSchedule.ok', 'OK');
	private readonly CancelButtonText: string = localize('pickSchedule.cancel', 'Cancel');
	private readonly SchedulesLabelText: string = localize('pickSchedule.availableSchedules', 'Available Schedules:');
	public static readonly ScheduleNameLabelText: string = localize('pickSchedule.scheduleName', 'Name');
	public static readonly SchedulesIDText: string = localize('pickSchedule.scheduleID','ID');
	public static readonly ScheduleDescription: string = localize('pickSchedule.description','Description');


	// UI Components
	private dialog: sqlops.window.Dialog;
	private schedulesTable: sqlops.TableComponent;

	private model: PickScheduleData;

	private _onSuccess: vscode.EventEmitter<PickScheduleData> = new vscode.EventEmitter<PickScheduleData>();
	public readonly onSuccess: vscode.Event<PickScheduleData> = this._onSuccess.event;

	constructor(ownerUri: string, jobName: string) {
		this.model = new PickScheduleData(ownerUri, jobName);
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
						PickScheduleDialog.SchedulesIDText,
						PickScheduleDialog.ScheduleNameLabelText,
						PickScheduleDialog.ScheduleDescription
					],
					data: [],
					height: 750,
					width: 430
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
					data[i] = [ schedule.id, schedule.name, schedule.description ];
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