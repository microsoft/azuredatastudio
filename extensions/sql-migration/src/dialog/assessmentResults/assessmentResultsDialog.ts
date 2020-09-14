/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../../mssql';
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlDatabaseTree } from './sqlDatabasesTree';
//import { SqlAssessmentResultList } from './sqlAssessmentResultsList';
//import { SqlAssessmentResult } from './sqlAssessmentResult';


export class AssessmentResultsDialog {

	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;

	private _tree: SqlDatabaseTree;
	//private _list: SqlAssessmentResultList;
	//private _result: SqlAssessmentResult;

	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string) {
		this._tree = new SqlDatabaseTree(model);
		//this._list = new SqlAssessmentResultList();
		//this._result = new SqlAssessmentResult();
	}


	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const treeComponent = await this._tree.createComponent(view);
					const separator1 = view.modelBuilder.separator().component();

					this.createResultsList(view);
					if (!this._assessmentTable || !this.model.assessmentResults) {
						return;
					}

					//const listComponent = await this._list.createComponent(view);
					//const separator2 = view.modelBuilder.separator().component();
					//const resultComponent = await this._result.createComponent(view);

					//const flex = view.modelBuilder.flexContainer().withItems([treeComponent, separator1, listComponent, separator2, resultComponent]);

					const flex = view.modelBuilder.flexContainer().withItems([treeComponent, separator1, this._assessmentTable]);


					let data = this.convertAssessmentToData(this.model.assessmentResults);
					this._assessmentTable.data = data;

					view.initializeModel(flex.component());

					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	private convertAssessmentToData(assessments: mssql.SqlMigrationAssessmentResultItem[] | undefined): Array<string | number>[] {
		let result: Array<string | number>[] = [];
		if (assessments) {
			assessments.forEach(assessment => {
				if (assessment.impactedObjects && assessment.impactedObjects.length > 0) {
					assessment.impactedObjects.forEach(impactedObject => {
						this.addAssessmentColumn(result, assessment, impactedObject);
					});
				} else {
					this.addAssessmentColumn(result, assessment, undefined);
				}
			});
		}
		return result;
	}

	private addAssessmentColumn(
		result: Array<string | number>[],
		assessment: mssql.SqlMigrationAssessmentResultItem,
		impactedObject: mssql.SqlMigrationImpactedObjectInfo | undefined): void {
		let cols = [];
		//cols.push(assessment.appliesToMigrationTargetPlatform);
		cols.push(assessment.displayName);
		cols.push(assessment.checkId);
		//cols.push(assessment.rulesetName);
		cols.push(assessment.description);
		cols.push(impactedObject?.name ?? '');
		result.push(cols);
	}


	private _assessmentTable: azdata.TableComponent | undefined;
	private createResultsList(view: azdata.ModelView): void {
		this._assessmentTable = view.modelBuilder.table()
			.withProperties({
				columns: [
					'Rule',
					'Rule ID',
					'Description',
					'Impacted Objects'
				],
				data: [],
				height: 700,
				width: 1100
			}).component();
	}


	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(this.title, this.title, true);

			this.dialog.okButton.label = AssessmentResultsDialog.OkButtonText;
			this.dialog.okButton.onClick(async () => await this.execute());

			this.dialog.cancelButton.label = AssessmentResultsDialog.CancelButtonText;
			this.dialog.cancelButton.onClick(async () => await this.cancel());

			const dialogSetupPromises: Thenable<void>[] = [];

			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);

			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		this._isOpen = false;
	}

	protected async cancel() {
		this._isOpen = false;
	}


	public get isOpen(): boolean {
		return this._isOpen;
	}
}
