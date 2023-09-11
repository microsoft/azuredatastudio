/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { MigrationTargetType } from '../../api/utils';
import { TreeComponent } from './treeComponent';
import { InstanceSummary } from './instanceSummary';

// Class that defines ui for body section of assessment result page
export class AssessmentDetailsBody {
	private _view!: azdata.ModelView;
	private _model!: MigrationStateModel;
	public _treeComponent!: TreeComponent;
	private _targetType!: MigrationTargetType;
	private _instanceSummary = new InstanceSummary();
	public _warningsOrIssuesListSection!: azdata.ListViewComponent;

	constructor(migrationStateModel: MigrationStateModel) {
		this._model = migrationStateModel;
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

		// returns the right section of body which defines summary of selected instance.
		const instanceSummary = this._instanceSummary.createInstanceSummaryContainer(view);

		bodyContainer.addItem(treeComponent, { flex: "none" });
		bodyContainer.addItem(assessmentFindingsComponent, { flex: "none" });
		bodyContainer.addItem(instanceSummary, { flex: "none" });

		return bodyContainer;
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

		const findingsSection = this._view.modelBuilder.listView().withProps({
			title: {
				text: constants.ASSESSMENT_FINDINGS_LABEL,
				style: { "border": "solid 1px" }
			},
			options: [{ label: constants.SUMMARY_TITLE, id: "summary" }]
		}).component();

		assessmentFindingsComponent.addItem(findingsSection);

		const warningsOrIssuesListSection = this._view.modelBuilder.listView().withProps({
			title: { text: constants.WARNINGS },
			options: []  // TODO: fill the list of options.
		}).component();

		assessmentFindingsComponent.addItem(warningsOrIssuesListSection);
		return assessmentFindingsComponent;
	}
}
