/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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

// Class where assessment details page is defined
export class AssessmentDetailsPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _header;
	private _body;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		wizard: azdata.window.Wizard,
		migrationStateModel: MigrationStateModel) {
		super(
			wizard,
			azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_PAGE_TITLE),
			migrationStateModel);
		this._header = new AssessmentDetailsHeader();
		this._body = new AssessmentDetailsBody(migrationStateModel);
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

		const headerSection = this._header.createAssessmentDetailsHeader(this._view);

		const bodySection = this._body.createAssessmentDetailsBody(this._view);

		// defines the functionality to execute when target platform for the page is changed.
		this._disposables.push(this._header.targetTypeDropdown.onValueChanged(async (value) => {
			if (value) {
				const selectedTargetType = this.getTargetTypeBasedOnSelection(value.selected);
				this.changeTargetType(selectedTargetType);
				await this._header.populateAssessmentDetailsHeader(this.migrationStateModel);
				await this._body.populateAssessmentBody(this.migrationStateModel);
			}
		}));

		const form = this._view.modelBuilder.formContainer()
			.withFormItems([
				{
					component: pageHeading
				},
				{
					component: headerSection
				},
				{
					component: bodySection
				}
			]).withProps({
				CSSStyles: { 'padding-top': '0' }
			}).component();
		await this._view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.migrationStateModel._targetType = MigrationTargetType.SQLDB;
		await this._header.populateAssessmentDetailsHeader(this.migrationStateModel);
		await this._body.populateAssessmentBody(this.migrationStateModel);
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
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
		}
		return MigrationTargetType.SQLDB;
	}

	// function to execute when user changes target type.
	private changeTargetType(newTargetType: string): void {
		switch (newTargetType) {
			case MigrationTargetType.SQLMI:
				const miDbs = this.migrationStateModel._miDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);
				this.migrationStateModel._targetType = MigrationTargetType.SQLMI;
				this.migrationStateModel._databasesForMigration = miDbs;
				break;
			case MigrationTargetType.SQLVM:
				const vmDbs = this.migrationStateModel._vmDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);
				this.migrationStateModel._targetType = MigrationTargetType.SQLVM;
				this.migrationStateModel._databasesForMigration = vmDbs;
				break;
			case MigrationTargetType.SQLDB:
				const dbDbs = this.migrationStateModel._sqldbDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);
				this.migrationStateModel._targetType = MigrationTargetType.SQLDB;
				this.migrationStateModel._databasesForMigration = dbDbs;
				break;
		}
		this.migrationStateModel.refreshDatabaseBackupPage = true;
	}
}
