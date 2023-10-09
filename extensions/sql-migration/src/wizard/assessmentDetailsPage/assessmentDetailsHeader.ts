/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { MigrationTargetType } from '../../api/utils';
import * as utils from '../../api/utils';
import { IssueCategory } from '../../constants/helper';

interface IActionMetadata {
	title?: string,
	value?: string
}

// Class defining header section of assessment details page
export class AssessmentDetailsHeader {
	private _view!: azdata.ModelView;
	private _valueContainers: azdata.TextComponent[] = [];
	private _targetSelectionDropdown!: azdata.DropDownComponent;

	// public getter for target type selection drop down.
	public get targetTypeDropdown() {
		return this._targetSelectionDropdown;
	}

	// function that creates the component for header section of assessment details page.
	public createAssessmentDetailsHeader(view: azdata.ModelView): azdata.Component {
		this._view = view;
		const headerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withProps({
			CSSStyles: {
				'margin-left': '15px'
			}
		}).component();

		const targetTypeContainer = this.createTargetTypeContainer();

		const headerCardsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		// List of card labels displayed in header section of Assessment details page.
		const assessmentHeaderLabels = [
			{
				title: constants.RECOMMENDED_CONFIGURATION
			},
			{
				title: constants.DATABASES_ASSESSED_LABEL
			},
			{
				title: constants.MIGRATION_TIME_LABEL
			}];

		// create individual card component for each property in above list
		headerCardsContainer.addItems(assessmentHeaderLabels.map(l => this.createCard(l)));

		headerContainer.addItems([targetTypeContainer, headerCardsContainer]);

		return headerContainer;
	}

	// function defining ui for card component in ui section.
	private createCard(linkMetaData: IActionMetadata) {

		const cardContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: 190,
			height: 75
		}).withProps({
			CSSStyles: {
				...styles.CARD_CSS,
			}
		}).component();

		const cardHeading = this._view.modelBuilder.text().withProps({
			value: linkMetaData.title,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0px'
			},
		}).component();

		const cardText = this._view.modelBuilder.text().withProps({
			value: linkMetaData.value,
			CSSStyles: {
				...styles.LABEL_CSS,
				'overflow-wrap': 'break-word'
			},
		}).component();

		cardContainer.addItems([cardHeading, cardText]);
		this._valueContainers.push(cardText);

		return cardContainer;
	}

	// function to populate the values of properties displayed in the cards.
	public async populateAssessmentDetailsHeader(migrationStateModel: MigrationStateModel): Promise<void> {
		// this value is populated to handle the case when user selects a target type and want to resume later.
		this._targetSelectionDropdown.value = this.getTargetTypeBasedOnModel(migrationStateModel._targetType);

		const recommendedConfigurations = await utils.getRecommendedConfiguration(migrationStateModel._targetType, migrationStateModel);
		let configurationValue = recommendedConfigurations[0] ?? "--";

		if (migrationStateModel._targetType === MigrationTargetType.SQLVM && recommendedConfigurations?.length > 1) {
			configurationValue = recommendedConfigurations[0] + "\n" + recommendedConfigurations[1];
		}
		const assessmentHeaderValues = [
			{
				value: configurationValue
			},
			{
				value: String(migrationStateModel?._assessedDatabaseList.length)
			},
			{
				value: String(migrationStateModel._assessmentResults.databaseAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === migrationStateModel._targetType && issue.issueCategory === IssueCategory.Issue)?.length === 0)?.length)
			}];

		// iterating over each value container and filling it with the corresponding text.
		let index = 0;
		this._valueContainers.forEach((valueContainer) =>
			valueContainer.value = assessmentHeaderValues[index++].value);
	}

	// function that create target selection dropdown
	private createTargetTypeContainer(): azdata.FlexContainer {
		const targetTypeContainer = this._view.modelBuilder.flexContainer().component();

		const selectLabel = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_TARGET_LABEL + ":",
			CSSStyles: {
				...styles.LABEL_CSS
			},
		}).component();

		this._targetSelectionDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.AZURE_SQL_TARGET,
			value: constants.SUMMARY_SQLDB_TYPE,
			values: [constants.SUMMARY_SQLDB_TYPE, constants.SUMMARY_VM_TYPE, constants.SUMMARY_MI_TYPE],
			width: 250,
			editable: false,
			CSSStyles: {
				'margin-top': '-0.2em',
				'margin-left': '10px'
			},
		}).component();

		targetTypeContainer.addItem(selectLabel, { flex: 'none' });
		targetTypeContainer.addItem(this._targetSelectionDropdown, { flex: 'none' });

		return targetTypeContainer;
	}

	// function to get target type value based on model value.
	private getTargetTypeBasedOnModel(targetType: MigrationTargetType): string {
		switch (targetType) {
			case MigrationTargetType.SQLDB:
				return constants.SUMMARY_SQLDB_TYPE;
			case MigrationTargetType.SQLVM:
				return constants.SUMMARY_VM_TYPE;
			case MigrationTargetType.SQLMI:
				return constants.SUMMARY_MI_TYPE;
			default:
				throw new Error('Unsupported type');
		}
	}
}
