/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { MigrationWizardPage } from '../../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../../models/stateMachine';
import { AssessmentDetailsHeader } from './assessmentDetailsHeader';
import { AssessmentDetailsBody } from './assessmentDetialsBody';
import { MigrationTargetType } from '../../api/utils';
import { EOL } from 'os';
import * as fs from 'fs';
import path = require('path');
import * as utils from '../../api/utils';
import { WizardController } from '../wizardController';

// Class where assessment details page is defined
export class AssessmentDetailsPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _headerSection!: azdata.Component;
	private _bodySection!: azdata.Component;
	private _header;
	private _body;
	private _disposables: vscode.Disposable[] = [];
	private static readonly _assessmentReportName: string = 'SqlAssessmentReport.json';
	private _previousTargetTypeUndefined: boolean = true;

	constructor(
		wizard: azdata.window.Wizard,
		migrationStateModel: MigrationStateModel,
		private wizardController: WizardController) {
		super(
			wizard,
			azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_PAGE_TITLE),
			migrationStateModel);
		this._header = new AssessmentDetailsHeader(migrationStateModel);
		this._body = new AssessmentDetailsBody(migrationStateModel, wizard);
	}

	// function to register assessment details page content.
	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		const pageHeading = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin': '0px 15px 0px 15px'
			},
			value: constants.ASSESSMENT_RESULTS_PAGE_HEADER
		}).component();

		this._headerSection = this._header.createAssessmentDetailsHeader(this._view);

		this._bodySection = await this._body.createAssessmentDetailsBodyAsync(this._view);

		// defines the functionality to execute when target platform for the page is changed.
		this._disposables.push(this._header.targetTypeDropdown.onValueChanged(async (value) => {
			if (value) {
				const selectedTargetType = this.getTargetTypeBasedOnSelection(value);
				await this.shouldNoTargetSelectionDisplayAsync(false);
				await this.executeChange(selectedTargetType);
				await this._header.populateAssessmentDetailsHeader(this.migrationStateModel);
				await this._body.populateAssessmentBodyAsync();
			}
		}));

		// added on click to export the assessment as Json
		this._disposables.push(
			this.wizard.customButtons[2].onClick(async () => {
				const folder = await utils.promptUserForFolder();
				if (folder) {
					const destinationFilePath = path.join(folder, AssessmentDetailsPage._assessmentReportName);
					if (this.migrationStateModel._assessmentReportFilePath) {
						fs.copyFile(this.migrationStateModel._assessmentReportFilePath, destinationFilePath, (err) => {
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

		const form = this._view.modelBuilder.formContainer()
			.withFormItems([
				{
					component: pageHeading
				},
				{
					component: this._headerSection
				},
				{
					component: this._bodySection
				}
			]).withProps({
				CSSStyles: { 'padding-top': '0' }
			}).component();
		await this._view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizardController.cancelReasonsList([
			constants.WIZARD_CANCEL_REASON_CONTINUE_WITH_MIGRATION_LATER,
			constants.WIZARD_CANCEL_REASON_NEED_TO_ANALYSE_FINDINGS
		]);

		this.wizard.registerNavigationValidator(async (pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}
			await this.executeChange(this.migrationStateModel._targetType);
			const errors: string[] = [];
			if (this.migrationStateModel._databasesForMigration.length === 0) {
				errors.push(constants.SELECT_DATABASE_TO_MIGRATE);
			}
			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
		// displaying save assessment button when enter on assessment page
		this.wizard.customButtons[2].hidden = false;
		if (this.migrationStateModel._targetType === undefined) {
			await this.shouldNoTargetSelectionDisplayAsync(true);
			this._previousTargetTypeUndefined = true;
		}
		else {
			await this.executeChange(this.migrationStateModel._targetType);
			await this._header.populateAssessmentDetailsHeader(this.migrationStateModel);
			await this._body.populateAssessmentBodyAsync();
		}
		this.wizard.nextButton.enabled = this.migrationStateModel._assessmentResults !== undefined;
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };
		// hiding save assessment button when page is left
		this.wizard.customButtons[2].hidden = true;
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private didUpdateDatabasesForMigration(priorDbs: string[], selectedDbs: string[]) {
		this.migrationStateModel._didUpdateDatabasesForMigration = selectedDbs.length === 0
			|| selectedDbs.length !== priorDbs.length
			|| priorDbs.some(db => selectedDbs.indexOf(db) < 0);
	}

	// function to give target type based on value selected in dropdown.
	private getTargetTypeBasedOnSelection(targetType: string): MigrationTargetType {
		switch (targetType) {
			case constants.SUMMARY_SQLDB_TYPE:
				return MigrationTargetType.SQLDB;
			case constants.SUMMARY_VM_TYPE:
				return MigrationTargetType.SQLVM;
			case constants.SUMMARY_MI_TYPE:
				return MigrationTargetType.SQLMI;
			default:
				throw new Error('Unsupported type');
		}
	}

	// function to execute when user changes target type for the selected databases.
	private async executeChange(newTargetType: string): Promise<void> {
		let selectedDbs = this._body.treeComponent.selectedDbs();

		// This condition is handled to select all the databases chosen for assessment by default(when page opens for the first time) to migrate as well.
		if (this._previousTargetTypeUndefined) {
			selectedDbs = this.migrationStateModel._databasesForAssessment;
			this._previousTargetTypeUndefined = false;
		}
		switch (newTargetType) {
			case MigrationTargetType.SQLMI:
				this.didUpdateDatabasesForMigration(this.migrationStateModel._miDbs, selectedDbs);
				this.migrationStateModel._miDbs = selectedDbs;
				const miDbs = this.migrationStateModel._miDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);
				this.migrationStateModel._targetType = MigrationTargetType.SQLMI;
				this.migrationStateModel._databasesForMigration = miDbs;
				break;
			case MigrationTargetType.SQLVM:
				this.didUpdateDatabasesForMigration(this.migrationStateModel._vmDbs, selectedDbs);
				this.migrationStateModel._vmDbs = selectedDbs;
				const vmDbs = this.migrationStateModel._vmDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);
				this.migrationStateModel._targetType = MigrationTargetType.SQLVM;
				this.migrationStateModel._databasesForMigration = vmDbs;
				break;
			case MigrationTargetType.SQLDB:
				this.didUpdateDatabasesForMigration(this.migrationStateModel._sqldbDbs, selectedDbs);
				this.migrationStateModel._sqldbDbs = selectedDbs;
				const dbDbs = this.migrationStateModel._sqldbDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);
				this.migrationStateModel._targetType = MigrationTargetType.SQLDB;
				this.migrationStateModel._databasesForMigration = dbDbs;
				break;
		}
		this.addWarningNotReadyCondition();
		this.migrationStateModel.refreshDatabaseBackupPage = true;
	}

	// function to add warning message to wizard in case of target change
	private addWarningNotReadyCondition() {
		var warningMessage;
		switch (this.migrationStateModel._targetType) {
			case MigrationTargetType.SQLMI: {
				warningMessage = constants.ASSESSMENT_MIGRATION_WARNING_SQLMI;
				break;
			}
			case MigrationTargetType.SQLDB: {
				warningMessage = constants.ASSESSMENT_MIGRATION_WARNING_SQLDB;
				break;
			}
			default: {
			}
		}

		if (this.migrationStateModel._assessmentResults?.databaseAssessments.some(db => db.issues.find(issue => issue.databaseRestoreFails && issue.appliesToMigrationTargetPlatform === this.migrationStateModel._targetType))) {
			if (warningMessage) {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Warning,
					text: warningMessage,
				};
			}
		}
	}

	//function to control display of no target selection text
	private async shouldNoTargetSelectionDisplayAsync(visible: boolean) {
		if (visible) {
			await utils.updateControlDisplay(this._bodySection, false);
			await utils.updateControlDisplay(this._header.headerCardsContainer, false);
			await utils.updateControlDisplay(this._header.noTargetSelectedContainer, true, 'flex');
		}
		else {
			await utils.updateControlDisplay(this._header.noTargetSelectedContainer, false);
			await utils.updateControlDisplay(this._bodySection, true, 'flex');
			await utils.updateControlDisplay(this._header.headerCardsContainer, true, 'flex');
		}
	}
}
