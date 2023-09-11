/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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

// Class that defines ui for body section of assessment result page
export class AssessmentDetailsBody {
	private _view!: azdata.ModelView;
	private _model!: MigrationStateModel;
	public _treeComponent!: TreeComponent;
	private _targetType!: MigrationTargetType;
	public _instanceSummary = new InstanceSummary();
	private _databaseSummary = new DatabaseSummary();
	private _issueSummary = new IssueSummary();
	public _warningsOrIssuesListSection!: azdata.ListViewComponent;
	private _findingsSummaryList!: azdata.ListViewComponent;
	private _disposables: vscode.Disposable[] = [];
	private _activeIssues!: SqlMigrationAssessmentResultItem[];

	constructor(migrationStateModel: MigrationStateModel,
		targetType: MigrationTargetType) {
		this._model = migrationStateModel;
		this._targetType = targetType;
		this._treeComponent = new TreeComponent(this._model, this._model._targetType)
	}

	// function that defines all the components for body section
	public createAssessmentDetailsBody(view: azdata.ModelView): azdata.Component {
		this._view = view;
		const bodyContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).withProps({
			CSSStyles: {
				'border-top': 'solid 1px'
			}
		}).component();

		// returns the side pane of tree component to select instance and databases.
		const treeComponent = this._treeComponent.createTreeComponent(
			view,
			(this._targetType === MigrationTargetType.SQLVM)
				? this._model._vmDbs
				: (this._targetType === MigrationTargetType.SQLMI)
					? this._model._miDbs
					: this._model._sqldbDbs);

		// returns middle section of body where list of issues and warnings are displayed.
		const assessmentFindingsComponent = this.createAssessmentFindingComponent();

		// returns the right section of body which defines the result of assessment.
		const resultComponent = this.createResultComponent();

		bodyContainer.addItem(treeComponent, { flex: "none" });
		bodyContainer.addItem(assessmentFindingsComponent, { flex: "none" });
		bodyContainer.addItem(resultComponent, { flex: "none" });

		return bodyContainer;
	}

	// function to populate data for body section
	public async populateAssessmentBody(): Promise<void> {
		await this._treeComponent.initialize();
		this._instanceSummary.populateInstanceSummaryContainer(this._model, this._model._targetType);
	}

	// function to create middle section of body that displays list of warnings/ issues.
	public createAssessmentFindingComponent(): azdata.FlexContainer {
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
			title: { text: constants.WARNINGS },
			options: []
		}).component();

		assessmentFindingsComponent.addItem(this._warningsOrIssuesListSection);
		return assessmentFindingsComponent;
	}

	private createResultComponent(): azdata.FlexContainer {
		const resultContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'border-left': 'solid 1px'
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
				"padding-right": "250px",
				"border-bottom": "solid 1px"
			}
		}).component();

		const bottomContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		// returns the right section of body which defines summary of selected instance.
		const instanceSummary = this._instanceSummary.createInstanceSummaryContainer(this._view);

		// returns the right section of body which defines summary of selected database.
		const databaseSummary = this._databaseSummary.createDatabaseSummary(this._view);
		databaseSummary.display = 'none';

		// returns the right section of body which defines summary of selected database.
		const issueSummary = this._issueSummary.createIssueSummary(this._view);
		issueSummary.display = 'none';

		bottomContainer.addItems([instanceSummary, databaseSummary, issueSummary]);

		resultContainer.addItems([heading, subHeading, bottomContainer]);

		let _isInstanceSummarySelected = true;

		this._disposables.push(this._treeComponent.instanceTable.onRowSelected(async (e) => {
			_isInstanceSummarySelected = true;
			this._targetType = this._model?._targetType;
			this._activeIssues = this._model._assessmentResults?.issues.filter(issue => issue.appliesToMigrationTargetPlatform === this._targetType);
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
			if (this._targetType === MigrationTargetType.SQLMI ||
				this._targetType === MigrationTargetType.SQLDB) {
				await this.refreshResults();
			}
			this._instanceSummary.populateInstanceSummaryContainer(this._model, this._targetType);
		}));

		this._disposables.push(this._treeComponent.databaseTable.onRowSelected(async (e) => {
			_isInstanceSummarySelected = false;
			if (this._targetType === MigrationTargetType.SQLMI ||
				this._targetType === MigrationTargetType.SQLDB) {
				this._activeIssues = this._model._assessmentResults?.databaseAssessments[e.row].issues.filter(i => i.appliesToMigrationTargetPlatform === this._targetType);
			} else {
				this._activeIssues = [];
			}
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
			await this._databaseSummary.populateDatabaseSummary(this._activeIssues, this._model._assessmentResults?.databaseAssessments[e.row]?.name);
			if (this._targetType === MigrationTargetType.SQLMI ||
				this._targetType === MigrationTargetType.SQLDB) {
				await this.refreshResults();
			}
			if (this._findingsSummaryList.options.length) {
				this._findingsSummaryList.selectedOptionId = '0';
			}
		}));

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
			await this._issueSummary.refreshAssessmentDetails(selectedIssue);
		}));

		return resultContainer;
	}

	public async refreshResults(): Promise<void> {
		if (this._targetType === MigrationTargetType.SQLMI ||
			this._targetType === MigrationTargetType.SQLDB) {
			let assessmentResults: azdata.ListViewOption[] = this._activeIssues
				.sort((e1, e2) => {
					if (e1.databaseRestoreFails) { return -1; }
					if (e2.databaseRestoreFails) { return 1; }
					return e1.checkId.localeCompare(e2.checkId);
				}).filter((v) => {
					return v.appliesToMigrationTargetPlatform === this._targetType;
				}).map((v, index) => {
					return {
						id: index.toString(),
						label: v.checkId,
						icon: v.databaseRestoreFails ? IconPathHelper.error : undefined,
						ariaLabel: v.databaseRestoreFails ? constants.BLOCKING_ISSUE_ARIA_LABEL(v.checkId) : v.checkId,
					};
				});

			this._warningsOrIssuesListSection.options = assessmentResults;
		}
	}
}
