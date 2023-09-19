/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { ColorCodes, IssueCategory } from '../../constants/helper';
import { MigrationStateModel } from '../../models/stateMachine';

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

	// function to create instance summary components
	public createInstanceSummaryContainer(view: azdata.ModelView): azdata.FlexContainer {
		this._view = view;
		const instanceSummaryContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const description = view.modelBuilder.text().withProps({
			value: constants.READINESS_SECTION_TITLE,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		this._assessedDatabases = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		const findingsSummaryTitle = view.modelBuilder.text().withProps({
			value: constants.INSTANCE_FINDING_SUMMARY,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px',
				'margin-top': '30px'
			}
		}).component();

		this._totalFindingLabels = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		instanceSummaryContainer.addItems([description, this._assessedDatabases, this.createGraphComponent(),
			findingsSummaryTitle, this._totalFindingLabels]);

		return instanceSummaryContainer;
	}

	// function to populate instance summary container with latest values.
	public populateInstanceSummaryContainer(model: MigrationStateModel): void {

		this._assessedDatabases.value = constants.ASSESSED_DBS_LABEL + ": " + model._databasesForAssessment?.length;
		this._totalFindingLabels.value = constants.TOTAL_FINDINGS_LABEL + ": " + model._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === model._targetType).length;
		const readyDbsCount = model._assessmentResults.databaseAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === model._targetType).length === 0).length;
		const notReadyDbsCount = model._assessmentResults.databaseAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === model._targetType && issue.issueCategory === IssueCategory.Issue).length !== 0).length;
		const readyWithWarnDbsCount = model._assessmentResults.databaseAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === model._targetType && issue.issueCategory === IssueCategory.Warning).length !== 0).length;

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
		const width = (Math.sqrt(value) / Math.sqrt(maxValue)) * 75;
		return width;
	}
}
