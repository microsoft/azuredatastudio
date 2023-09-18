/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { SqlMigrationAssessmentResultItem } from '../../service/contracts';

// Class defines the database summary.
export class DatabaseSummary {

	private _view!: azdata.ModelView;
	private _readinessTitle!: azdata.TextComponent;
	private _totalIssues!: azdata.TextComponent;
	private _readinessDescription!: azdata.TextComponent;
	private _readinessIcon!: azdata.ImageComponent;
	private _readinessText!: azdata.TextComponent;

	// function that creates database summary ui
	public createDatabaseSummary(view: azdata.ModelView): azdata.FlexContainer {
		this._view = view;
		const databaseSummaryContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		this._readinessTitle = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		const issuesSummaryTitle = view.modelBuilder.text().withProps({
			value: constants.DATABASE_ISSUES_SUMMARY,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px',
				'margin-top': '30px'
			}
		}).component();

		this._totalIssues = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0px',
				'padding-left': '10px'
			}
		}).component();

		this._readinessDescription = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px',
				'margin-top': '2px',
				'padding-left': '38px'
			}
		}).component();

		databaseSummaryContainer.addItem(this._readinessTitle);

		databaseSummaryContainer.addItem(this.createIconTextContainer());

		databaseSummaryContainer.addItem(this._readinessDescription);

		databaseSummaryContainer.addItems([
			issuesSummaryTitle, this._totalIssues]);

		return databaseSummaryContainer;
	}

	//creates icon-text container depicting state for selected database.
	private createIconTextContainer(): azdata.FlexContainer {
		const iconTextContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row'
		}).withProps({ CSSStyles: { 'padding-left': '10px', 'margin-top': '10px' } }).component();

		this._readinessIcon = this._view.modelBuilder.image().withProps({
			iconPath: "",
			iconHeight: 24,
			iconWidth: 24,
			width: 24,
			height: 24,
			CSSStyles: { 'margin-right': '4px' }
		}).component();

		this._readinessText = this._view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.PAGE_SUBTITLE_CSS,
				'font-weight': '400',
				'margin': '0px'
			}
		}).component();

		iconTextContainer.addItem(this._readinessIcon, { flex: 'none' });
		iconTextContainer.addItem(this._readinessText, { flex: 'none' });

		return iconTextContainer;
	}

	// function to populate database summary with latest data values.
	public async populateDatabaseSummary(issues: SqlMigrationAssessmentResultItem[], dbName: string) {
		this._readinessTitle.value = constants.DB_READINESS_SECTION_TITLE(dbName);
		this._totalIssues.value = constants.TOTAL_ISSUES_LABEL + ":" + issues.length;
		if (issues.length > 0) {
			this._readinessDescription.value = constants.NON_READINESS_DESCRIPTION(issues.length);
			this._readinessIcon.iconPath = IconPathHelper.sqlDatabaseNotReadyLogo;
			this._readinessText.value = constants.NOT_READY;
		}
		else {
			this._readinessDescription.value = constants.READINESS_DESCRIPTION;
			this._readinessIcon.iconPath = IconPathHelper.sqlDatabaseLogo;
			this._readinessText.value = constants.READY;
		}
	}

}
