/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';
import { MigrationStateModel } from '../models/stateMachine';

export class AssessmentResultsDialog {

	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';

	// protected _onSuccess: vscode.EventEmitter<T> = new vscode.EventEmitter<T>();
	protected _isOpen: boolean = false;
	// public readonly onSuccess: vscode.Event<T> = this._onSuccess.event;
	public dialog: azdata.window.Dialog | undefined;

	private assessmentTable: azdata.TableComponent | undefined;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;

	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string) {
	}

	protected async updateModel(): Promise<void> {
		return undefined;
	}

	protected async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async view => {
			this.assessmentTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						'Target',
						'Target Name',
						'Rule ID',
						'Rule Name',
						'Description',
						'Impacted Objects'
					],
					data: [],
					height: 300,
					width: 1100
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([
					{
						components: [{
							component: this.assessmentTable,
							title: 'Results',
							layout: {
								info: 'Assessment Results'
							}
						}],
						title: 'Assessment Results'
					}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);

			let data = this.convertAssessmentToData(this.model.assessmentResults);
			this.assessmentTable.data = data;
		});

		/*
		dialog.registerCloseValidator(async () => {
			this.updateModel();
			let validationResult = await this.model.validate();
			if (!validationResult.valid) {
				// TODO: Show Error Messages
				dialog.message = { text: validationResult.errorMessages[0] };
				console.error(validationResult.errorMessages.join(','));
			}

			return validationResult.valid;
		});
		*/
	}

	private convertAssessmentToData(assessments: mssql.SqlMigrationAssessmentResultItem[] | undefined): Array<string | number>[] {
		let result: Array<string | number>[] = [];
		if (assessments) {
			assessments.forEach(assessment => {
				let cols = [];
				cols.push(assessment.appliesToMigrationTargetPlatform);
				cols.push(assessment.displayName);
				cols.push(assessment.checkId);
				cols.push(assessment.rulesetName);
				cols.push(assessment.description);
				cols.push('Impacted Objects');
				result.push(cols);
			});
		}
		return result;
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(this.title, this.title, true);

			// await this.model.initialize();

			await this.initializeDialog(this.dialog);

			this.dialog.okButton.label = AssessmentResultsDialog.OkButtonText;
			this.dialog.okButton.onClick(async () => await this.execute());

			this.dialog.cancelButton.label = AssessmentResultsDialog.CancelButtonText;
			this.dialog.cancelButton.onClick(async () => await this.cancel());

			azdata.window.openDialog(this.dialog);
		}
	}

	protected async execute() {
		this.updateModel();
		// await this.model.save();
		this._isOpen = false;
		// this._onSuccess.fire(this.model);
	}

	protected async cancel() {
		this._isOpen = false;
	}


	public get isOpen(): boolean {
		return this._isOpen;
	}
}
