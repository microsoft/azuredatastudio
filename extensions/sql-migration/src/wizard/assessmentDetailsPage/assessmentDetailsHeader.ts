/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { MigrationTargetType } from '../../api/utils';

interface IActionMetadata {
	title?: string,
	value?: string
}

// Class defining header section of Assessment Details page
export class AssessmentDetailsHeader {
	private _view!: azdata.ModelView;
	private _migrationStateModel: MigrationStateModel;
	private _valueContainers: azdata.TextComponent[] = [];

	constructor(migrationStateModel: MigrationStateModel) {
		this._migrationStateModel = migrationStateModel;
	}

	public createAssessmentDetailsHeader(view: azdata.ModelView): azdata.Component {
		this._view = view;
		const headerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		// List of card labels displayed in header section of Assessment details page.
		const assessmentHeaderLabels = [
			{
				title: constants.TARGET_PLATFORM
			},
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
		headerContainer.addItems(assessmentHeaderLabels.map(l => this.createCard(l)));

		return headerContainer;
	}

	// function defining ui for card component in ui section.
	private createCard(linkMetaData: IActionMetadata) {

		const cardContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: 190,
		}).withProps({
			CSSStyles: {
				'width': '190px',
				'box-shadow': '0px 1px 4px rgba(0, 0, 0, 0.13)',
				'padding': '8px 0px 8px 12px',
				'border-radius': '4px',
				'margin': '8px 0px 0px 15px'
			}
		}).component();

		const cardHeading = this._view.modelBuilder.text().withProps({
			value: linkMetaData.title,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'margin': '0px'
			},
		}).component();

		const cardText = this._view.modelBuilder.text().withProps({
			value: linkMetaData.value,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '600',
				'overflow-wrap': 'break-word'
			},
		}).component();

		cardContainer.addItems([cardHeading, cardText]);
		this._valueContainers.push(cardText);

		return cardContainer;
	}

	// function to populate the values of properties displayed in the cards.
	public async populateAssessmentDetailsHeader(): Promise<void> {

		const assessmentHeaderValues = [
			{
				value: this._getTargetPlatformLabel(this._migrationStateModel?._targetType)
			},
			{
				// TODO(stutijain): replace below value with recommended config
				value: "10 available"
			},
			{
				value: String(this._migrationStateModel?._assessedDatabaseList.length)
			},
			{
				// TODO(stutijain): confirm ready to migration value and replace here.
				value: "8"
			}];

		// iterating over each value container and filling it with the corresponding text.
		let index = 0;
		this._valueContainers.forEach((valueContainer) =>
			valueContainer.value = assessmentHeaderValues[index++].value);
	}

	// function that returns a localised string for target platform based on enum MigrationTargetType.
	private _getTargetPlatformLabel(targetType: MigrationTargetType): string {
		switch (targetType) {
			case MigrationTargetType.SQLDB:
				return constants.SUMMARY_SQLDB_TYPE
			case MigrationTargetType.SQLVM:
				return constants.SUMMARY_VM_TYPE
			case MigrationTargetType.SQLMI:
				return constants.SUMMARY_MI_TYPE
			default:
				return "--"
		}
	}
}
