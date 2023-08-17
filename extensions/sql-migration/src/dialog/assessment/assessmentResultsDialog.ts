/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlDatabaseTree } from './sqlDatabasesTree';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';
import * as constants from '../../constants/strings';
import * as utils from '../../api/utils';
import { MigrationTargetType } from '../../api/utils';
import * as fs from 'fs';
import path = require('path');
import { SqlMigrationImpactedObjectInfo } from '../../service/contracts';

export type Issues = {
	description: string,
	recommendation: string,
	moreInfo: string,
	impactedObjects: SqlMigrationImpactedObjectInfo[],
};
export class AssessmentResultsDialog {

	private static readonly SelectButtonText: string = 'Select';
	private static readonly CancelButtonText: string = 'Cancel';
	private static readonly OkButtonText: string = 'OK';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;
	private _model: MigrationStateModel;
	private _saveButton!: azdata.window.Button;
	private static readonly _assessmentReportName: string = 'SqlAssessmentReport.json';
	private _title: string;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;
	private _tree: SqlDatabaseTree;
	private _disposables: vscode.Disposable[] = [];

	constructor(public ownerUri: string, public model: MigrationStateModel, public serverName: string, private _skuRecommendationPage: SKURecommendationPage, private _targetType?: MigrationTargetType, private _readOnly = false) {
		this._model = model;
		this._title = constants.ASSESSMENT_TITLE(serverName);
		this._tree = new SqlDatabaseTree(this._model, this._targetType, _readOnly);
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._tree = new SqlDatabaseTree(this._model, this._targetType, this._readOnly);
			dialog.registerContent(async (view) => {
				try {
					const flex = view.modelBuilder.flexContainer().withLayout({
						flexFlow: 'row',
						height: '100%',
						width: '100%'
					}).component();
					flex.addItem(await this._tree.createRootContainer(dialog, view), { flex: '1 1 auto' });

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } });
					}));

					await view.initializeModel(flex);
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
			this.dialog = azdata.window.createModelViewDialog(this._title, 'AssessmentResults', 'wide');

			this.dialog.customButtons = [];

			this.dialog.okButton.label = AssessmentResultsDialog.SelectButtonText;
			this.dialog.okButton.position = 'left';
			if (this._readOnly) {
				this.dialog.okButton.enabled = false;
				this.dialog.okButton.hidden = true;

				this.dialog.cancelButton.label = AssessmentResultsDialog.OkButtonText;
			} else {
				this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));

				this.dialog.cancelButton.label = AssessmentResultsDialog.CancelButtonText;

				this._saveButton = azdata.window.createButton(
					constants.SAVE_ASSESSMENT_REPORT,
					'right');
				this._disposables.push(
					this._saveButton.onClick(async () => {
						const folder = await utils.promptUserForFolder();
						if (folder) {
							const destinationFilePath = path.join(folder, AssessmentResultsDialog._assessmentReportName);
							if (this.model._assessmentReportFilePath) {
								fs.copyFile(this.model._assessmentReportFilePath, destinationFilePath, (err) => {
									if (err) {
										console.log(err);
									} else {
										void vscode.window.showInformationMessage(constants.SAVE_ASSESSMENT_REPORT_SUCCESS(destinationFilePath));
									}
								});
							} else {
								console.log('assessment report not found');
							}
						}
					}));

				this.dialog.customButtons.push(this._saveButton);
			}

			this.dialog.cancelButton.position = 'left';
			this._disposables.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

			const dialogSetupPromises: Thenable<void>[] = [];

			dialogSetupPromises.push(this.initializeDialog(this.dialog));

			azdata.window.openDialog(this.dialog);

			await Promise.all(dialogSetupPromises);

			await this._tree.initialize();
		}
	}

	protected async execute() {
		const selectedDbs = this._tree.selectedDbs();
		switch (this._targetType) {
			case MigrationTargetType.SQLMI: {
				this.didUpdateDatabasesForMigration(this._model._miDbs, selectedDbs);
				this._model._miDbs = selectedDbs;
				break;
			}
			case MigrationTargetType.SQLVM: {
				this.didUpdateDatabasesForMigration(this._model._vmDbs, selectedDbs);
				this._model._vmDbs = selectedDbs;
				break;
			}
			case MigrationTargetType.SQLDB: {
				this.didUpdateDatabasesForMigration(this._model._sqldbDbs, selectedDbs);
				this._model._sqldbDbs = selectedDbs;
				break;
			}
		}
		await this._skuRecommendationPage.refreshCardText();
		this.model.refreshDatabaseBackupPage = true;
		this._isOpen = false;
	}

	private didUpdateDatabasesForMigration(priorDbs: string[], selectedDbs: string[]) {
		this._model._didUpdateDatabasesForMigration = selectedDbs.length === 0
			|| selectedDbs.length !== priorDbs.length
			|| priorDbs.some(db => selectedDbs.indexOf(db) < 0);
	}

	protected async cancel() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
