/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import { SqlDatabaseTree } from './sqlDatabasesTree';
import { SqlMigrationImpactedObjectInfo } from '../../../../mssql/src/mssql';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';

export type Issues = {
	description: string,
	recommendation: string,
	moreInfo: string,
	impactedObjects: SqlMigrationImpactedObjectInfo[],
};
export class AssessmentResultsDialog {

	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;
	private _model: MigrationStateModel;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;
	private _tree: SqlDatabaseTree;
	private _disposables: vscode.Disposable[] = [];

	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string, private _skuRecommendationPage: SKURecommendationPage, private _targetType: MigrationTargetType) {
		this._model = model;
		this._tree = new SqlDatabaseTree(this._model, this._targetType);
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
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
			this.dialog = azdata.window.createModelViewDialog(this.title, this.title, 'wide');

			this.dialog.okButton.label = AssessmentResultsDialog.OkButtonText;
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));

			this.dialog.cancelButton.label = AssessmentResultsDialog.CancelButtonText;
			this._disposables.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

			const dialogSetupPromises: Thenable<void>[] = [];

			dialogSetupPromises.push(this.initializeDialog(this.dialog));

			azdata.window.openDialog(this.dialog);

			await Promise.all(dialogSetupPromises);

			await this._tree.initialize();
		}
	}

	protected async execute() {
		if (this._targetType === MigrationTargetType.SQLVM) {
			this._model._vmDbs = this._tree.selectedDbs();
		} else {
			this._model._miDbs = this._tree.selectedDbs();
		}
		await this._skuRecommendationPage.refreshCardText();
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
