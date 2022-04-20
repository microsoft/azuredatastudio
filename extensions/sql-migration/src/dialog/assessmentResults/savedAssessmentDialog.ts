/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { WizardController } from '../../wizard/wizardController';
import * as styles from '../../constants/styles';

export class SavedAssessmentDialog {

	private static readonly OkButtonText: string = constants.NEXT_LABEL;
	private static readonly CancelButtonText: string = constants.CANCEL_LABEL;

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;
	private _rootContainer!: azdata.FlexContainer;
	private stateModel: MigrationStateModel;
	private context: vscode.ExtensionContext;
	private _disposables: vscode.Disposable[] = [];

	constructor(context: vscode.ExtensionContext, stateModel: MigrationStateModel) {
		this.stateModel = stateModel;
		this.context = context;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					this._rootContainer = this.initializePageContent(view);
					await view.initializeModel(this._rootContainer);
					this._disposables.push(dialog.okButton.onClick(async e => {
						await this.execute();
					}));
					this._disposables.push(dialog.cancelButton.onClick(e => {
						this.cancel();
					}));

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } }
						);
					}));
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
			this.dialog = azdata.window.createModelViewDialog(constants.SAVED_ASSESSMENT_RESULT, constants.SAVED_ASSESSMENT_RESULT, '60%');
			this.dialog.okButton.label = SavedAssessmentDialog.OkButtonText;
			this.dialog.cancelButton.label = SavedAssessmentDialog.CancelButtonText;
			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		if (this.stateModel.resumeAssessment) {
			const wizardController = new WizardController(this.context, this.stateModel);
			await wizardController.openWizard(this.stateModel.sourceConnectionId);
		} else {
			// normal flow
			const wizardController = new WizardController(this.context, this.stateModel);
			await wizardController.openWizard(this.stateModel.sourceConnectionId);
		}
		this._isOpen = false;
	}

	protected cancel() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	public initializePageContent(view: azdata.ModelView): azdata.FlexContainer {
		const buttonGroup = 'resumeMigration';

		const pageTitle = view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin-bottom': '12px'
			},
			value: constants.RESUME_TITLE
		}).component();

		const radioStart = view.modelBuilder.radioButton().withProps({
			label: constants.START_MIGRATION,
			name: buttonGroup,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '8px'
			},
			checked: true
		}).component();

		radioStart.onDidChangeCheckedState((e) => {
			if (e) {
				this.stateModel.resumeAssessment = false;
			}
		});
		const radioContinue = view.modelBuilder.radioButton().withProps({
			label: constants.CONTINUE_MIGRATION,
			name: buttonGroup,
			CSSStyles: {
				...styles.BODY_CSS,
			},
			checked: false
		}).component();

		radioContinue.onDidChangeCheckedState((e) => {
			if (e) {
				this.stateModel.resumeAssessment = true;
			}
		});

		const flex = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: '100%',
			}).withProps({
				CSSStyles: {
					'margin': '20px 15px',
				}
			}).component();
		flex.addItem(pageTitle, { flex: '0 0 auto' });
		flex.addItem(radioStart, { flex: '0 0 auto' });
		flex.addItem(radioContinue, { flex: '0 0 auto' });

		return flex;
	}

}
