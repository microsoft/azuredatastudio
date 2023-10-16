/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlMigrationImpactedObjectInfo } from '../../service/contracts';
import { AssessmentDetailsBody } from '../../wizard/assessmentDetailsPage/assessmentDetialsBody';

export type Issues = {
	description: string,
	recommendation: string,
	moreInfo: string,
	impactedObjects: SqlMigrationImpactedObjectInfo[],
};
export class ImportAssessmentDialog {

	private static readonly OkButtonText: string = 'OK';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;
	private _body;
	private _disposables: vscode.Disposable[] = [];

	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string) {
		this._body = new AssessmentDetailsBody(model, {} as azdata.window.Wizard);
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
					flex.addItem(await this._body.createAssessmentDetailsBodyAsync(view), { flex: '1 1 auto' });

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
			this.dialog = azdata.window.createModelViewDialog(this.title, 'AssessmentResults', 'wide');

			this.dialog.okButton.hidden = true;
			this.dialog.cancelButton.label = ImportAssessmentDialog.OkButtonText;
			this.dialog.cancelButton.position = 'left';

			const dialogSetupPromises: Thenable<void>[] = [];

			dialogSetupPromises.push(this.initializeDialog(this.dialog));

			azdata.window.openDialog(this.dialog);

			await Promise.all(dialogSetupPromises);

			await this._body.populateAssessmentBodyAsync();
		}
	}
}
