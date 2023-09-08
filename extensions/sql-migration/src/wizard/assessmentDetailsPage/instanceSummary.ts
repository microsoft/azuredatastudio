/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { IconPathHelper } from '../../constants/iconPathHelper';

interface IActionMetadata {
	label: string,
	count: number,
	iconPath?: azdata.IconPath,
	color?: string
}

// Class that defines Instance Summary section.
export class InstanceSummary {
	private _view!: azdata.ModelView;

	// function to create instance summary components
	public createInstanceSummaryContainer(view: azdata.ModelView): azdata.FlexContainer {
		this._view = view;
		const instanceSummaryContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'border-left': 'solid 1px'
			}
		}).component();

		const heading = view.modelBuilder.text().withProps({
			value: constants.DETAILS_TITLE,
			CSSStyles: {
				...styles.LABEL_CSS,
				"padding": "5px",
				"border-bottom": "solid 1px"
			}
		}).component();

		const subHeading = view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_SUMMARY_TITLE,
			CSSStyles: {
				...styles.LABEL_CSS,
				"padding": "10px",
				"border-bottom": "solid 1px"
			}
		}).component();

		const description = view.modelBuilder.text().withProps({
			value: constants.READINESS_SECTION_TITLE,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		const assessedDatabasesLabel = view.modelBuilder.text().withProps({
			value: constants.ASSESSED_DBS_LABEL + ":",
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

		const totalFindingsLabel = view.modelBuilder.text().withProps({
			value: constants.TOTAL_FINDINGS_LABEL + ":",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		const findingsSummarySubtitle = view.modelBuilder.text().withProps({
			value: constants.SEVERITY_FINDINGS_LABEL,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'margin-top': '10px',
				'padding-left': '10px'
			}
		}).component();

		const findings = [
			{
				label: constants.ISSUES_LABEL,
				count: 0,
				iconPath: IconPathHelper.error
			},
			{
				label: constants.WARNINGS,
				count: 0,
				iconPath: IconPathHelper.warning
			}];

		instanceSummaryContainer.addItems([heading, subHeading, description, assessedDatabasesLabel, this.createGraphComponent(),
			findingsSummaryTitle, totalFindingsLabel, findingsSummarySubtitle]);

		instanceSummaryContainer.addItems(findings.map(l => this.createFindingsContainer(l)));
		return instanceSummaryContainer;
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
				count: 1,
				color: "#E00B1C"
			},
			{
				label: constants.READY_WARN,
				count: 1,
				color: "#DB7500"
			},
			{
				label: constants.READY,
				count: 8,
				color: "#57A300"
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

		if (linkMetaData.count !== 0) {

			const divWidth = this.setWidth(linkMetaData.count, maxValue);

			const division = this._view.modelBuilder.divContainer().withProps({
				CSSStyles: {
					'margin-top': '12px',
					'margin-left': '10px',
					'background-color': linkMetaData.color ?? "",
					'height': '30px',
				}
			}).component();

			if (divWidth !== 0) {
				barComponent.addItem(division, { CSSStyles: { 'width': divWidth + '%' } });
			}

		}

		return barComponent;
	}

	private createYAxisComponent(linkMetaData: IActionMetadata): azdata.Component {

		const yAxisLabelContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'width': '80px',
				'margin-top': '12px',
				'height': '30px',
				'overflow-wrap': 'break-word'
			}
		}).component();

		const yAxisLabel = this._view.modelBuilder.text().withProps({
			value: linkMetaData.label + " (" + linkMetaData.count + ")",
			CSSStyles: {
				...styles.CARD_AXES_LABEL,
				'overflow-wrap': 'break-word'
			},
		}).component();

		yAxisLabelContainer.addItem(yAxisLabel);

		return yAxisLabelContainer;
	}

	private setWidth(value: number, maxValue: number): number {
		const width = (Math.sqrt(value) / Math.sqrt(maxValue)) * 75;
		return width;
	}

	private createFindingsContainer(linkMetaData: IActionMetadata): azdata.FlexContainer {
		const findingContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'row',
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		const findingImage = this._view.modelBuilder.image().withProps({
			iconPath: linkMetaData.iconPath,
			iconHeight: 12,
			iconWidth: 12,
			width: 12,
			height: 19,
			CSSStyles: { 'margin-right': '4px' }
		}).component();

		const findingLabel = this._view.modelBuilder.text().withProps({
			value: linkMetaData.label + ":",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px', 'margin-right': '4px'
			}
		}).component();

		const findingCount = this._view.modelBuilder.text().withProps({
			value: String(linkMetaData.count),
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px', 'margin-right': '4px'
			}
		}).component();

		findingContainer.addItem(findingImage, { flex: 'none' });
		findingContainer.addItem(findingLabel, { flex: 'none' });
		findingContainer.addItem(findingCount, { flex: 'none' });
		return findingContainer;
	}
}
