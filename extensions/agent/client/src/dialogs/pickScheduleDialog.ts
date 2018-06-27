/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 'use strict';
import * as sqlops from 'sqlops';
import { PickScheduleData } from '../data/pickScheduleData';

export class PickScheduleDialog {

	// TODO: localize
	// Top level
	//
	private readonly DialogTitle: string = 'Job Schedules';
	private readonly OkButtonText: string = 'OK';
	private readonly CancelButtonText: string = 'Cancel';
	private readonly SchedulesTabText: string = 'Schedules';

	// UI Components
	//
	private dialog: sqlops.window.modelviewdialog.Dialog;
	private scheduleTab: sqlops.window.modelviewdialog.DialogTab;
	private schedulesTable: sqlops.TableComponent;

	private model: PickScheduleData;

	constructor(ownerUri: string) {
		this.model = new PickScheduleData(ownerUri);
	}

	public async showDialog() {
		await this.model.initialize();
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.DialogTitle);
		this.scheduleTab = sqlops.window.modelviewdialog.createTab(this.SchedulesTabText);
		this.initializeContent();
		this.dialog.content = [this.scheduleTab];
		this.dialog.okButton.onClick(async () => await this.execute());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeContent() {
		this.scheduleTab.registerContent(async view => {
			this.schedulesTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						'Schedule Name',
						'Description'
					],
					data: [],
					height: 400
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.schedulesTable,
					title: 'Schedules'
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			if (this.model.schedules) {
				let data: any[][] = [];
				for (let i = 0; i < this.model.schedules.length; ++i) {
					let schedule = this.model.schedules[i];
					data[i] = [ schedule.name, 'bb' ];
					// let schedule = this.model.schedules[i];
					// data[i] = [ schedule.name, schedule.isEnabled ? 'true' : 'false'];
				}
				this.schedulesTable.data = data;
			}
		});
	}

	private async execute() {
		this.updateModel();
		await this.model.save();
	}

	private async cancel() {
	}

	private updateModel() {
	}
}