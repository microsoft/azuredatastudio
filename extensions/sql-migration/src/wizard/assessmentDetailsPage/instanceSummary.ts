/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as vscode from 'vscode';
import * as utils from '../../api/utils';
import { ColorCodes, IssueCategory } from '../../constants/helper';
import { AssessmentRuleId, MigrationStateModel } from '../../models/stateMachine';
import { TdeConfigurationDialog } from '../../dialog/tdeConfiguration/tdeConfigurationDialog';
import { ConfigDialogSetting, TdeMigrationModel } from '../../models/tdeModels';
import { TelemetryAction, TelemetryViews, getTelemetryProps, sendSqlMigrationActionEvent } from '../../telemetry';

interface IActionMetadata {
	label: string,
	count?: number,
	iconPath?: azdata.IconPath,
	color?: string
}

// Class that defines Instance Summary section.
export class InstanceSummary {
	private _view!: azdata.ModelView;
	private _assessedDatabases!: azdata.TextComponent;
	private _totalFindingLabels!: azdata.TextComponent;
	private _yAxisLabels: azdata.TextComponent[] = [];
	private _divs: azdata.FlexContainer[] = [];
	private _disposables: vscode.Disposable[] = [];
	private _tdeInfoContainer!: azdata.FlexContainer;
	private _tdeConfigurationDialog!: TdeConfigurationDialog;
	private _previousMiTdeMigrationConfig: TdeMigrationModel = new TdeMigrationModel(); // avoid null checks
	private _tdeDatabaseSelectedHelperText!: azdata.TextComponent;
	private _tdeEditButton!: azdata.ButtonComponent;

	constructor(public migrationStateModel: MigrationStateModel) { }

	// function to create instance summary components
	public async createInstanceSummaryContainerAsync(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		this._view = view;
		const instanceSummaryContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'padding-left': '10px'
			}
		}).component();

		const description = view.modelBuilder.text().withProps({
			value: constants.READINESS_SECTION_TITLE,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px'
			}
		}).component();

		this._assessedDatabases = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px'
			}
		}).component();

		const findingsSummaryTitle = view.modelBuilder.text().withProps({
			value: constants.INSTANCE_FINDING_SUMMARY,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'margin-top': '30px'
			}
		}).component();

		this._totalFindingLabels = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px'
			}
		}).component();

		this._tdeInfoContainer = await this.createTdeInfoContainerAsync();

		instanceSummaryContainer.addItems([description,
			this._assessedDatabases, this.createGraphComponent(),
			this._tdeInfoContainer, findingsSummaryTitle,
			this._totalFindingLabels]);

		return instanceSummaryContainer;
	}

	// function to populate instance summary container with latest values.
	public async populateInstanceSummaryContainerAsync(): Promise<void> {
		this._previousMiTdeMigrationConfig = this.migrationStateModel.tdeMigrationConfig;
		await this.refreshTdeViewAsync();
		this._assessedDatabases.value = constants.ASSESSED_DBS_LABEL(this.migrationStateModel._assessmentResults?.databaseAssessments?.length);
		this._totalFindingLabels.value = constants.TOTAL_FINDINGS_LABEL(this.migrationStateModel._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this.migrationStateModel._targetType).length);

		const dbAssessments = this.migrationStateModel._assessmentResults.databaseAssessments;
		const readyDbsCount = dbAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this.migrationStateModel._targetType).length === 0).length;
		const notReadyDbsCount = dbAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this.migrationStateModel._targetType && issue.issueCategory === IssueCategory.Issue).length !== 0).length;
		const readyWithWarnDbsCount = dbAssessments.length - (readyDbsCount + notReadyDbsCount);

		const readinessStates = [
			{
				label: constants.NOT_READY,
				count: notReadyDbsCount,
				color: ColorCodes.NotReadyState_Red
			},
			{
				label: constants.READY_WARN,
				count: readyWithWarnDbsCount,
				color: ColorCodes.ReadyWithWarningState_Amber
			},
			{
				label: constants.READY,
				count: readyDbsCount,
				color: ColorCodes.ReadyState_Green
			}];

		let readinessStateIndex = 0; // variable to iterate on readinessStates list

		// update value of YAxis for three states.
		this._yAxisLabels.forEach(component => { component.value = readinessStates[readinessStateIndex].label + " (" + readinessStates[readinessStateIndex++].count + ")"; });

		// update width of states of ready, not ready and readyWithWarn in the graph bar component.
		readinessStateIndex = 0;
		let maxValue = 1;
		readinessStates.forEach(readinessState => maxValue = Math.max(readinessState.count, maxValue));
		this._divs.forEach(async (component) => {
			const divWidth = this.setWidth(readinessStates[readinessStateIndex++].count ?? 0, maxValue);
			await component.updateCssStyles({ 'width': divWidth + '%' });
		});
	}

	// Create graph depicting dbs readiness.
	private createGraphComponent(): azdata.FlexContainer {
		const graph = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
			}
		}).component();

		const readinessStates = [
			{
				label: constants.NOT_READY,
				color: ColorCodes.NotReadyState_Red
			},
			{
				label: constants.READY_WARN,
				color: ColorCodes.ReadyWithWarningState_Amber
			},
			{
				label: constants.READY,
				color: ColorCodes.ReadyState_Green
			}];

		// create individual bar component for each property in above list
		graph.addItems(readinessStates.map(l => this.createBarComponent(l)));
		return graph;
	}

	// create individual bar component
	private createBarComponent(linkMetaData: IActionMetadata) {

		const barComponent = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row'
			}
		}).component();
		barComponent.addItem(this.createYAxisComponent(), { 'flex': 'none' });

		const division = this._view.modelBuilder.divContainer().withProps({
			width: '0px',
			CSSStyles: {
				'margin-top': '12px',
				'margin-left': '10px',
				'background-color': linkMetaData.color ?? "",
				'height': '30px',
				'width': '0px'
			}
		}).component();

		// storing divisions to update later based on selections.
		this._divs.push(division);
		barComponent.addItem(division);

		return barComponent;
	}

	// create y axis details of the bar component
	private createYAxisComponent(): azdata.FlexContainer {

		const yAxisLabelContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'width': '80px',
				'margin-top': '12px',
				'height': '30px',
				'overflow-wrap': 'break-word'
			}
		}).component();

		const yAxisLabel = this._view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.CARD_AXES_LABEL,
				'overflow-wrap': 'break-word'
			},
		}).component();

		this._yAxisLabels.push(yAxisLabel);

		yAxisLabelContainer.addItem(yAxisLabel);

		return yAxisLabelContainer;
	}

	// maths formula to calculate width of bar component and create comparison among diff values.
	private setWidth(value: number, maxValue: number): number {
		if (maxValue === 0)
			return 0;
		const width = (Math.sqrt(value) / Math.sqrt(maxValue)) * 75;
		return width;
	}

	private async createTdeInfoContainerAsync(): Promise<azdata.FlexContainer> {
		const container = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column'
			}
		}).component();

		this._tdeEditButton = this._view.modelBuilder.button().withProps({
			label: constants.TDE_BUTTON_CAPTION,
			width: 180,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0',
				'margin-top': '30px'
			}
		}).component();
		this._tdeConfigurationDialog = new TdeConfigurationDialog(this.migrationStateModel, () => this._onTdeConfigClosed());
		this._disposables.push(this._tdeEditButton.onDidClick(
			async (e) => await this._tdeConfigurationDialog.openDialog()));

		this._tdeDatabaseSelectedHelperText = this._view.modelBuilder.text()
			.withProps({
				CSSStyles: { ...styles.BODY_CSS },
				ariaLive: 'polite',
			}).component();

		container.addItems([
			this._tdeEditButton,
			this._tdeDatabaseSelectedHelperText]);

		await utils.updateControlDisplay(container, false);

		return container;
	}


	private _resetTdeConfiguration() {
		this._previousMiTdeMigrationConfig = this.migrationStateModel.tdeMigrationConfig;
		this.migrationStateModel.tdeMigrationConfig = new TdeMigrationModel();
	}

	public async refreshTdeViewAsync() {

		if (this.migrationStateModel._targetType !== utils.MigrationTargetType.SQLMI) {

			//Reset the encrypted databases counter on the model to ensure the certificates migration is ignored.
			this._resetTdeConfiguration();

		} else {

			const encryptedDbFound = this.migrationStateModel._assessmentResults.databaseAssessments
				.filter(
					db => this.migrationStateModel._databasesForMigration.findIndex(dba => dba === db.name) >= 0 &&
						db.issues.findIndex(iss => iss.ruleId === AssessmentRuleId.TdeEnabled && iss.appliesToMigrationTargetPlatform === utils.MigrationTargetType.SQLMI) >= 0
				)
				.map(db => db.name);

			if (this._matchWithEncryptedDatabases(encryptedDbFound)) {
				this.migrationStateModel.tdeMigrationConfig = this._previousMiTdeMigrationConfig;
			} else {
				if (!utils.isWindows()) //Only available for windows for now.
					return;

				//Set encrypted databases
				this.migrationStateModel.tdeMigrationConfig.setTdeEnabledDatabasesCount(encryptedDbFound);

				if (this.migrationStateModel.tdeMigrationConfig.hasTdeEnabledDatabases()) {
					//Set the text when there are encrypted databases.
					const tdeMsg = (this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting() === ConfigDialogSetting.ExportCertificates) ? constants.TDE_WIZARD_MSG_TDE : constants.TDE_WIZARD_MSG_MANUAL;
					this._tdeDatabaseSelectedHelperText.value = constants.TDE_MSG_DATABASES_SELECTED(this.migrationStateModel.tdeMigrationConfig.getTdeEnabledDatabasesCount(), tdeMsg);

				} else {
					this._tdeDatabaseSelectedHelperText.value = constants.TDE_WIZARD_MSG_EMPTY;
				}

			}
		}

		await utils.updateControlDisplay(this._tdeInfoContainer, this.migrationStateModel.tdeMigrationConfig.hasTdeEnabledDatabases());
	}

	private _onTdeConfigClosed(): Thenable<void> {
		const tdeMsg = (this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting() === ConfigDialogSetting.ExportCertificates) ? constants.TDE_WIZARD_MSG_TDE : constants.TDE_WIZARD_MSG_MANUAL;
		this._tdeDatabaseSelectedHelperText.value = constants.TDE_MSG_DATABASES_SELECTED(this.migrationStateModel.tdeMigrationConfig.getTdeEnabledDatabasesCount(), tdeMsg);

		let tdeTelemetryAction: TelemetryAction;

		switch (this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting()) {
			case ConfigDialogSetting.ExportCertificates:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationUseADS;
				break;
			case ConfigDialogSetting.DoNotExport:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationAlreadyMigrated;
				break;
			case ConfigDialogSetting.NoSelection:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationCancelled;
				break;
			default:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationCancelled;
				break;
		}

		sendSqlMigrationActionEvent(
			TelemetryViews.TdeConfigurationDialog,
			tdeTelemetryAction,
			{
				...getTelemetryProps(this.migrationStateModel),
				'numberOfDbsWithTde': this.migrationStateModel.tdeMigrationConfig.getTdeEnabledDatabasesCount().toString()
			},
			{}
		);

		return this._tdeEditButton.focus();
	}

	private _matchWithEncryptedDatabases(encryptedDbList: string[]): boolean {
		var currentTdeDbs = this._previousMiTdeMigrationConfig.getTdeEnabledDatabases();

		if (encryptedDbList.length === 0 || encryptedDbList.length !== currentTdeDbs.length)
			return false;

		if (encryptedDbList.filter(db => currentTdeDbs.findIndex(dba => dba === db) < 0).length > 0)
			return false; //There is at least one element that is not in the other array. There should be no risk of duplicates table names
		return true;
	}
}
