/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlDatabaseTree } from './sqlDatabasesTree';
import { SqlAssessmentResultList } from './sqlAssessmentResultsList';
import { SqlAssessmentResult } from './sqlAssessmentResult';


export class AssessmentResultsDialog {

	private static readonly OkButtonText: string = 'OK';
	private static readonly CancelButtonText: string = 'Cancel';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;

	private _tree: SqlDatabaseTree;
	private _list: SqlAssessmentResultList;
	private _result: SqlAssessmentResult;

	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string) {
		this._tree = new SqlDatabaseTree();
		this._list = new SqlAssessmentResultList();
		this._result = new SqlAssessmentResult();
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const treeComponent = await this._tree.createComponent(view);
					const separator1 = view.modelBuilder.separator().component();
					const listComponent = await this._list.createComponent(view);
					const separator2 = view.modelBuilder.separator().component();
					const resultComponent = await this._result.createComponent(view);

					const flex = view.modelBuilder.flexContainer().withItems([treeComponent, separator1, listComponent, separator2, resultComponent]);

					view.initializeModel(flex.component());
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
