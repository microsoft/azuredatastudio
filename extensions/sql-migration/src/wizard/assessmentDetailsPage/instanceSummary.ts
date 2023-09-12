/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { ColorCodes } from '../../constants/helper';
import { MigrationStateModel } from '../../models/stateMachine';
import { MigrationTargetType } from '../../api/utils';

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

	public populateInstanceSummaryContainer(model: MigrationStateModel, targetType: MigrationTargetType): void {

		this._assessedDatabases.value = constants.ASSESSED_DBS_LABEL + ": " + model._databasesForAssessment?.length;
		this._totalFindingLabels.value = constants.TOTAL_FINDINGS_LABEL + ": " + model._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === targetType).length;
		const readyDbsCount = model._assessmentResults.databaseAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === targetType).length === 0).length;
		const notReadyDbsCount = model._databasesForAssessment?.length - readyDbsCount;
		const readywithWarnDbsCount = 0;

		const labels = [
			{
				label: constants.NOT_READY,
				count: notReadyDbsCount,
				color: ColorCodes.NotReadyState_Red
			},
			{
				label: constants.READY_WARN,
				count: readywithWarnDbsCount,
				color: ColorCodes.ReadyWithWarningState_Amber
			},
			{
				label: constants.READY,
				count: readyDbsCount,
				color: ColorCodes.ReadyState_Green
			}];
		let i = 0;
		this._yAxisLabels.forEach(component => { component.value = labels[i].label + " (" + labels[i].count + ")"; i++; });
		i = 0;
		let maxValue = 1;
		labels.forEach(label => maxValue = Math.max(label.count, maxValue));
		this._divs.forEach(async (component) => {
			const divWidth = this.setWidth(labels[i++].count ?? 0, maxValue);
			await component.updateCssStyles({ 'width': divWidth + '%' });
		});
	}

	private createGraphComponent(): azdata.FlexContainer {
		const graph = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
			}
		}).component();

		const labels = [
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

		// create individual card component for each property in above list
		graph.addItems(labels.map(l => this.createBarComponent(l, 8)));
		return graph;
	}

	private createBarComponent(linkMetaData: IActionMetadata, maxValue: number) {

		const barComponent = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row'
			}
		}).component();
		barComponent.addItem(this.createYAxisComponent(linkMetaData), { 'flex': 'none' });

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
		this._divs.push(division);
		barComponent.addItem(division);

		return barComponent;
	}

	private createYAxisComponent(linkMetaData: IActionMetadata): azdata.FlexContainer {

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

	private setWidth(value: number, maxValue: number): number {
		const width = (Math.sqrt(value) / Math.sqrt(maxValue)) * 75;
		return width;
	}
}
