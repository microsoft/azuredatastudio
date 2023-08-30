/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { MigrationWizardPage } from '../../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../../models/stateMachine';
import { AssessmentDetailsHeader } from './assessmentDetailsHeader';
import { AssessmentDetailsBody } from './assessmentDetialsBody';

export class AssessmentDetailsPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _header;
	private _body;

	constructor(
		wizard: azdata.window.Wizard,
		migrationStateModel: MigrationStateModel) {
		super(
			wizard,
			azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_PAGE_TITLE),
			migrationStateModel);
		this._header = new AssessmentDetailsHeader(migrationStateModel);
		this._body = new AssessmentDetailsBody(migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		const pageHeading = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin': '0px 15px 0px 15px'
			},
			value: constants.ASSESSMENT_RESULTS_PAGE_HEADER
		}).component();

		const headerSection = this._header.createAssessmentDetailsHeader(this._view);

		const form = this._view.modelBuilder.formContainer()
			.withFormItems([
				{
					component: pageHeading
				},
				{
					component: headerSection
				}
			]).withProps({
				CSSStyles: { 'padding-top': '0' }
			}).component();
		await this._view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		await this._header.populateAssessmentDetailsHeader();
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
