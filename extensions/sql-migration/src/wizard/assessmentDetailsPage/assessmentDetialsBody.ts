/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { MigrationStateModel } from '../../models/stateMachine';
import { MigrationTargetType } from '../../api/utils';
import { TreeComponent } from './treeComponent';
import { InstanceSummary } from './instanceSummary';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { DatabaseSummary } from './databaseSummary';
import { IssueSummary } from './issueSummary';
import { SqlMigrationAssessmentResultItem } from '../../service/contracts';
import { IssueCategory } from '../../constants/helper';

// Class that defines ui for body section of assessment result page
export class AssessmentDetailsBody {
	private _view!: azdata.ModelView;
	private _treeComponent!: TreeComponent;
	private _instanceSummary;
	private _databaseSummary = new DatabaseSummary();
	private _issueSummary = new IssueSummary();
	private _warningsOrIssuesListSection!: azdata.ListViewComponent;
	private _findingsSummaryList!: azdata.ListViewComponent;
	private _disposables: vscode.Disposable[] = [];
	private _activeIssues!: SqlMigrationAssessmentResultItem[];

	constructor(public migrationStateModel: MigrationStateModel,
		public wizard: azdata.window.Wizard,
		readonly: boolean = false) {
		this._treeComponent = new TreeComponent(wizard, migrationStateModel, readonly);
		this._instanceSummary = new InstanceSummary(migrationStateModel);
	}

	public get treeComponent() {
		return this._treeComponent;
	}

	// function that defines all the components for body section
	public async createAssessmentDetailsBodyAsync(view: azdata.ModelView): Promise<azdata.Component> {
		this._view = view;
		const bodyContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).withProps({
			CSSStyles: {
				'border-top': 'solid 1px',
				'border-bottom': 'solid 1px',
				'margin-left': '15px'
			}
		}).component();

		// returns the left side pane (tree component) to select instance and databases.
		const treeComponent = this._treeComponent.createTreeComponent(view);

		// returns middle section of body where list of issues and warnings are displayed.
		const findingsListComponent = this.createFindingsListComponent();

		// returns the right section of body which defines the summary of selected instance/database.
		const summaryComponent = await this.createSummaryComponentAsync();

		bodyContainer.addItem(treeComponent, { flex: "none" });
		bodyContainer.addItem(findingsListComponent, { flex: "none" });
		bodyContainer.addItem(summaryComponent, { flex: "none", CSSStyles: { 'width': '450px', 'min-height': '400px', 'border-left': 'solid 1px' } });

		return bodyContainer;
	}

	// function to populate data for body section
	public async populateAssessmentBodyAsync(): Promise<void> {
		await this._treeComponent.initialize();
		this._activeIssues = this.migrationStateModel._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this.migrationStateModel?._targetType);
		await this.refreshResultsAsync();
		await this._instanceSummary.populateInstanceSummaryContainerAsync();
	}

	// function to create middle section of body that displays list of warnings/ issues.
	public createFindingsListComponent(): azdata.FlexContainer {
		const assessmentFindingsComponent = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: "190px"
		}).withProps({
			CSSStyles: {
				"width": "190px"
			}
		}).component();

		this._findingsSummaryList = this._view.modelBuilder.listView().withProps({
			title: {
				text: constants.ASSESSMENT_FINDINGS_LABEL,
				style: { "border": "solid 1px" }
			},
			options: [{ label: constants.SUMMARY_TITLE, id: "summary" }]
		}).component();

		assessmentFindingsComponent.addItem(this._findingsSummaryList);

		this._warningsOrIssuesListSection = this._view.modelBuilder.listView().withProps({
			title: { text: constants.FINDINGS_LABEL },
			options: []
		}).component();

		assessmentFindingsComponent.addItem(this._warningsOrIssuesListSection);
		return assessmentFindingsComponent;
	}

	// creates ui for summary component based on selections in left panel.
	private async createSummaryComponentAsync(): Promise<azdata.FlexContainer> {
		const summaryContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withProps({
			width: '450px',
			CSSStyles: {
				'width': '450px'
			}
		}).component();

		const heading = this._view.modelBuilder.text().withProps({
			value: constants.DETAILS_TITLE,
			CSSStyles: {
				...styles.LABEL_CSS,
				"padding": "5px",
				"border-bottom": "solid 1px"
			}
		}).component();

		const subHeading = this._view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_SUMMARY_TITLE,
			CSSStyles: {
				...styles.LABEL_CSS,
				"padding": "5px",
				"padding-left": "10px",
				"border-bottom": "solid 1px"
			}
		}).component();

		const bottomContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		// returns the right section of body which defines summary of selected instance.
		const instanceSummary = await this._instanceSummary.createInstanceSummaryContainerAsync(this._view);

		// returns the right section of body which defines summary of selected database.
		const databaseSummary = this._databaseSummary.createDatabaseSummary(this._view);
		databaseSummary.display = 'none';

		// returns the right section of body which defines summary of selected database.
		const issueSummary = this._issueSummary.createIssueSummary(this._view);
		issueSummary.display = 'none';

		bottomContainer.addItems([instanceSummary, databaseSummary, issueSummary]);

		summaryContainer.addItems([heading, subHeading, bottomContainer]);

		let _isInstanceSummarySelected = true;

		// when an instance is selected
		this._disposables.push(this._treeComponent.instanceTable.onRowSelected(async (e) => {
			_isInstanceSummarySelected = true;
			this._activeIssues = this.migrationStateModel._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this.migrationStateModel?._targetType);
			await instanceSummary.updateCssStyles({
				'display': 'block'
			});
			await databaseSummary.updateCssStyles({
				'display': 'none'
			});
			await issueSummary.updateCssStyles({
				'display': 'none'
			});
			await subHeading.updateProperty('value', constants.ASSESSMENT_SUMMARY_TITLE);
			await this.refreshResultsAsync();
			await this._instanceSummary.populateInstanceSummaryContainerAsync();
		}));

		// when database is selected
		this._disposables.push(this._treeComponent.databaseTable.onRowSelected(async (e) => {
			_isInstanceSummarySelected = false;
			this._activeIssues = this.migrationStateModel._assessmentResults?.databaseAssessments[e.row].issues.filter(i => i.appliesToMigrationTargetPlatform === this.migrationStateModel?._targetType);
			await instanceSummary.updateCssStyles({
				'display': 'none'
			});
			await issueSummary.updateCssStyles({
				'display': 'none'
			});
			await databaseSummary.updateCssStyles({
				'display': 'block'
			});
			await subHeading.updateProperty('value', constants.ASSESSMENT_SUMMARY_TITLE);
			await this.refreshResultsAsync();
			await this._databaseSummary.populateDatabaseSummaryAsync(this._activeIssues, this.migrationStateModel._assessmentResults?.databaseAssessments[e.row]?.name);
			if (this._findingsSummaryList.options.length) {
				this._findingsSummaryList.selectedOptionId = '0';
			}
		}));

		// when summary is selected.
		this._disposables.push(this._findingsSummaryList.onDidClick(async (e: azdata.ListViewClickEvent) => {
			if (_isInstanceSummarySelected) {
				await instanceSummary.updateCssStyles({
					'display': 'block'
				});
				await databaseSummary.updateCssStyles({
					'display': 'none'
				});
			}
			else {
				await instanceSummary.updateCssStyles({
					'display': 'none'
				});
				await databaseSummary.updateCssStyles({
					'display': 'block'
				});
			}
			await issueSummary.updateCssStyles({
				'display': 'none'
			});
			await subHeading.updateProperty('value', constants.ASSESSMENT_SUMMARY_TITLE);
		}));

		// when issue/warning is selected.
		this._disposables.push(this._warningsOrIssuesListSection.onDidClick(async (e: azdata.ListViewClickEvent) => {
			const selectedIssue = this._activeIssues[parseInt(this._warningsOrIssuesListSection.selectedOptionId!)];
			await instanceSummary.updateCssStyles({
				'display': 'none'
			});
			await databaseSummary.updateCssStyles({
				'display': 'none'
			});
			await issueSummary.updateCssStyles({
				'display': 'block'
			});
			await subHeading.updateProperty('value', selectedIssue?.checkId || '');
			await this._issueSummary.refreshAssessmentDetailsAsync(selectedIssue);
		}));

		return summaryContainer;
	}

	// function to get latest issues/warnings list for the selected instance/database.
	public async refreshResultsAsync(): Promise<void> {
		if (this.migrationStateModel?._targetType === MigrationTargetType.SQLMI ||
			this.migrationStateModel?._targetType === MigrationTargetType.SQLDB) {
			let assessmentResults: azdata.ListViewOption[] = this._activeIssues
				.sort((e1, e2) => {
					if (e1.databaseRestoreFails) { return -1; }
					if (e2.databaseRestoreFails) { return 1; }
					return e1.checkId.localeCompare(e2.checkId);
				}).filter((v) => {
					return v.appliesToMigrationTargetPlatform === this.migrationStateModel?._targetType;
				}).map((v, index) => {
					return {
						id: index.toString(),
						label: v.checkId,
						icon: v.issueCategory === IssueCategory.Issue ? IconPathHelper.error : IconPathHelper.warning,
						ariaLabel: v.databaseRestoreFails ? constants.BLOCKING_ISSUE_ARIA_LABEL(v.checkId) : v.checkId,
					};
				});

			let uniqueLabels = new Set<string>();
			let uniqueOptions = new Map<string, azdata.ListViewOption>();

			// loop through the assessmentResults array and add the labels and options to the set and map
			for (let result of assessmentResults) {
				if (!uniqueLabels.has(result.label)) {
					uniqueLabels.add(result.label);
					uniqueOptions.set(result.label, result);
				}
			}

			// create a new array of ListViewOption objects from the map values
			let uniqueAssessmentResults: azdata.ListViewOption[] = Array.from(uniqueOptions.values());

			this._warningsOrIssuesListSection.options = uniqueAssessmentResults;
		}
		else {
			this._warningsOrIssuesListSection.options = [];
		}
	}
}
