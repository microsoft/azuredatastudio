/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlDatabaseTree } from './sqlDatabasesTree';
import { SqlMigrationImpactedObjectInfo } from '../../../../mssql/src/mssql';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';

export type Issues = {
	description: string,
	recommendation: string,
	moreInfo: string,
	impactedObjects: SqlMigrationImpactedObjectInfo[],
	rowNumber: number
};
export class AssessmentResultsDialog {

	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;
	private _model: MigrationStateModel;
	private _serverName: string;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;

	private _tree: SqlDatabaseTree;


	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string, private skuRecommendationPage: SKURecommendationPage, migrationType: string) {
		this._model = model;
		this._serverName = '';
		let assessmentData = this.parseData(this._model);
		this._tree = new SqlDatabaseTree(this._model, assessmentData, migrationType, this._serverName);
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const resultComponent = await this._tree.createComponentResult(view);
					const treeComponent = await this._tree.createComponent(view);

					const flex = view.modelBuilder.flexContainer().withLayout({
						flexFlow: 'row',
						height: '100%',
						width: '100%'
					}).withProps({
						CSSStyles: {
							'margin-top': '10px'
						}
					}).component();
					flex.addItem(treeComponent, { flex: '0 0 auto' });
					flex.addItem(resultComponent, { flex: '1 1 auto' });

					view.initializeModel(flex);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(this.title, this.title, '90%');

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


	private parseData(model: MigrationStateModel): Map<string, Issues[]> {
		// if there are multiple issues for the same DB, need to consolidate
		// map DB name -> Assessment result items (issues)
		// map assessment result items to description, recommendation, more info & impacted objects

		let dbMap = new Map<string, Issues[]>();
		if (model.assessmentResults && !model.assessmentResults![0].targetName.includes(':')) {
			this._serverName = model.assessmentResults![0].targetName;
		}


		model.assessmentResults?.forEach((element) => {
			let issues: Issues;
			issues = {
				description: element.description,
				recommendation: element.message,
				moreInfo: element.helpLink,
				impactedObjects: element.impactedObjects,
				rowNumber: 0
			};
			if (element.targetName.includes(':')) {
				let spliceIndex = element.targetName.indexOf(':');
				let dbName = element.targetName.slice(spliceIndex + 1);
				let dbIssues = dbMap.get(element.targetName);
				if (dbIssues) {
					dbMap.set(dbName, dbIssues.concat([issues]));
				} else {
					dbMap.set(dbName, [issues]);
				}
			} else {
				let dbIssues = dbMap.get(element.targetName);
				if (dbIssues) {
					dbMap.set(element.targetName, dbIssues.concat([issues]));
				} else {
					dbMap.set(element.targetName, [issues]);
				}
			}

		});

		return dbMap;
	}

	protected async execute() {
		this.model._migrationDbs = this._tree.selectedDbs();
		this.skuRecommendationPage.refreshDatabaseCount(this._model._migrationDbs.length);
		this.model.refreshDatabaseBackupPage = true;
		this._isOpen = false;
	}

	protected async cancel() {
		this._isOpen = false;
	}


	public get isOpen(): boolean {
		return this._isOpen;
	}
}
