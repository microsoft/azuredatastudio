/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
* This conatins code for creation of Assessment Summary card for each of the target platform -
* SQL VM,SQL MI, SQL DB
----------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { MigrationTargetType } from '../../api/utils';
import { IconPathHelper } from '../../constants/iconPathHelper';

export class AssessmentSummaryCard implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];

	private _assessmentResultText!: azdata.TextComponent;
	private _readyText!: azdata.TextComponent;
	private _needsReviewText!: azdata.TextComponent;
	private _notReadyText!: azdata.TextComponent;
	private _blockersText!: azdata.TextComponent;
	private _warningsText!: azdata.TextComponent;

	private _recommendedConfigurationText!: azdata.TextComponent;
	private _vmRecommendedConfigurationText!: azdata.TextComponent;

	constructor(public migrationTargetType: MigrationTargetType) {
	}

	public createAssessmentSummaryCard(view: azdata.ModelView): azdata.FlexContainer {
		const cardContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'height': '394px',
				'width': '244px',
				'text-align': 'center',
				'display': 'flex',
				'flex-direction': 'column',
				'justify-content': 'center',
				'box-shadow': '0px 1px 4px rgba(0, 0, 0, 0.13)',
				'border-radius': '2px',
				// 'margin-top': '16px',
				'padding': '16px 8px, 16px, 8px',
				'gap': '16px'
			}
		}).component();

		const labelContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row',
			}
		}).component();
		const labelImage = view.modelBuilder.image().withProps({
			iconPath: "",
			iconHeight: 34,
			iconWidth: 34,
			height: 34,
			CSSStyles: {
				'margin-top': '8px'
			}
		}).component();
		const labelText = view.modelBuilder.text().withProps({
			value: "",
			width: 147,
			height: 40,
			CSSStyles: {
				'font-size': '14px',
				'line-height': '20px',
				'font-weight': '600',
				'margin': '0px',
				'padding-top': '5px',
				// 'padding-left': '44px'
			},
		}).component();


		switch (this.migrationTargetType) {
			case MigrationTargetType.SQLDB:
				labelImage.iconPath = IconPathHelper.sqlDatabaseLogo;
				labelText.value = constants.SKU_RECOMMENDATION_SQLDB_CARD_TEXT;
				break;
			case MigrationTargetType.SQLMI:
				labelImage.iconPath = IconPathHelper.sqlMiLogo;
				labelText.value = constants.SKU_RECOMMENDATION_MI_CARD_TEXT;
				break;
			case MigrationTargetType.SQLVM:
				labelImage.iconPath = IconPathHelper.sqlVmLogo
				labelText.value = constants.SKU_RECOMMENDATION_VM_CARD_TEXT;
				break;
		}

		labelContainer.addItem(labelImage);
		labelContainer.addItem(labelText);

		cardContainer.addItem(labelContainer);
		cardContainer.addItem(this.createAssessmentResultsContainer(view));
		cardContainer.addItem(this.createRecommendedConfigurationContainer(view));

		return cardContainer;
	}

	private createAssessmentResultsContainer(view: azdata.ModelView) {
		const container = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
				'gap': '8px'
			}
		}).component();

		const assessmentResultsHeading = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
				'gap': '4px'
			}
		}).component();

		const assessmentResultsTextContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
				'gap': '0px',
				// 'height': '32',
			}
		}).component();

		const assessmentResultPreText = view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_RESULTS.toUpperCase(),
			description: "", //TODO - add description later
			CSSStyles: {
				...styles.TOOLBAR_CSS,
				'margin-left': '55px'
			},
		}).component();

		this._assessmentResultText = view.modelBuilder.text().withProps({
			value: "",
			CSSStyles: {
				...styles.TOOLBAR_CSS
			},
		}).component();

		assessmentResultsTextContainer.addItems([assessmentResultPreText, this._assessmentResultText]);

		const assessmentResultsImage = view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.completedMigration,
			iconHeight: 24,
			iconWidth: 24,
			height: 24,
		}).component();

		assessmentResultsHeading.addItems([assessmentResultsTextContainer, assessmentResultsImage]);

		const migrationReadiness = this.createMigrationReadinessContainer(view);
		const assessmentFindings = this.createAssessmentFindingsContainer(view);

		container.addItem(assessmentResultsHeading);
		container.addItem(migrationReadiness);
		container.addItem(assessmentFindings);

		return container;
	}

	private createMigrationReadinessContainer(view: azdata.ModelView) {
		const container = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
				'gap': '4px'
			}
		}).component();

		const migrationReadinessText = view.modelBuilder.text().withProps({
			value: constants.MIGRATION_READINESS_LABEL,
			height: 16,
			CSSStyles: {
				...styles.TOOLBAR_CSS
			},
		}).component();

		const readinessComponentContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row',
				'gap': '8px'
			}
		}).component();

		const ready = this.createResultComponentContainer(view, AssessmentResultType.READY);
		const neadsReview = this.createResultComponentContainer(view, AssessmentResultType.NEEDS_REVIEW);
		const notReady = this.createResultComponentContainer(view, AssessmentResultType.NOT_READY);

		readinessComponentContainer.addItem(ready);
		readinessComponentContainer.addItem(neadsReview);
		readinessComponentContainer.addItem(notReady);

		container.addItem(migrationReadinessText);
		container.addItem(readinessComponentContainer);
		return container;
	}

	private createAssessmentFindingsContainer(view: azdata.ModelView) {
		const container = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
				'gap': '4px'
			}
		}).component();

		const assessmentFindingsText = view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_FINDINGS_LABEL,
			height: 16,
			CSSStyles: {
				...styles.TOOLBAR_CSS
			},
		}).component();

		const assessmentFindingsComponentContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row',
				'gap': '8px'
			}
		}).component();

		const blockers = this.createResultComponentContainer(view, AssessmentResultType.BLOCKERS,);
		const warnings = this.createResultComponentContainer(view, AssessmentResultType.WARNINGS);

		assessmentFindingsComponentContainer.addItem(blockers);
		assessmentFindingsComponentContainer.addItem(warnings);

		container.addItem(assessmentFindingsText);
		container.addItem(assessmentFindingsComponentContainer);
		return container;
	}

	private createResultComponentContainer(view: azdata.ModelView, assessmentResultType: AssessmentResultType) {
		const container = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
			}
		}).component();

		const label = view.modelBuilder.text().withProps({
			value: "",
			height: 16,
			CSSStyles: {
				...styles.TOOLBAR_CSS
			},
		}).component();

		const value = view.modelBuilder.text().withProps({
			value: "",
			height: 22,
		}).component();


		switch (assessmentResultType) {
			case AssessmentResultType.READY:
				label.value = constants.READY;
				value.CSSStyles = {
					...styles.ASSESSMENT_SUMMARY_CARD_CSS,
					'color': '#57A300',
				};
				this._readyText = value;
				break;
			case AssessmentResultType.NEEDS_REVIEW:
				label.value = constants.NEEDS_REVIEW;
				value.CSSStyles = {
					...styles.ASSESSMENT_SUMMARY_CARD_CSS,
					'color': '#DB7500',
				};
				this._needsReviewText = value;
				break;
			case AssessmentResultType.NOT_READY:
				label.value = constants.NOT_READY;
				value.CSSStyles = {
					...styles.ASSESSMENT_SUMMARY_CARD_CSS,
					'color': '#E00B1C',
				};
				this._notReadyText = value;
				break;
			case AssessmentResultType.BLOCKERS:
				label.value = constants.BLOCKERS;
				value.CSSStyles = {
					...styles.ASSESSMENT_SUMMARY_CARD_CSS,
					'color': '#323130',
				};
				this._blockersText = value;
				break;
			case AssessmentResultType.WARNINGS:
				label.value = constants.WARNINGS;
				value.CSSStyles = {
					...styles.ASSESSMENT_SUMMARY_CARD_CSS,
					'color': '#323130',
				};
				this._warningsText = value;
				break;
		}

		container.addItems([label, value]);
		return container;
	}


	private createRecommendedConfigurationContainer(view: azdata.ModelView) {
		const container = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'column',
				'gap': '4px'
			}
		}).component();

		const recommendedConfigurationLabel = view.modelBuilder.text().withProps({
			value: constants.RECOMMENDED_CONFIGURATION.toUpperCase(),
			description: "", // TODO - need this value later
			height: 18,
			CSSStyles: {
				...styles.TOOLBAR_CSS,
				'text-align': 'center',
				'align': 'center',
				'margin-left': '20px',
			},
		}).component();

		this._recommendedConfigurationText = view.modelBuilder.text().withProps({
			value: "",
			height: 18,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '600',
				'margin': '0px',
			},
		}).component();

		this._vmRecommendedConfigurationText = view.modelBuilder.text().withProps({
			value: "",
			height: 28,
			CSSStyles: {
				'font-size': '10px',
				'line-height': '14px',
				'font-weight': '400',
				'margin': '0px',
			},
		}).component();

		const viewDetailsLink = view.modelBuilder.hyperlink().withProps({
			label: constants.VIEW_DETAILS,
			url: '',
			height: 18,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': '400',
				'line-height': '18px',
				'text-decoration': 'none',
			}
		}).component();


		container.addItem(recommendedConfigurationLabel);
		container.addItem(this._recommendedConfigurationText);

		switch (this.migrationTargetType) {
			case MigrationTargetType.SQLVM:
				container.addItem(this._vmRecommendedConfigurationText);
				container.addItem(viewDetailsLink);
				break;
			default:
				container.addItem(viewDetailsLink);
				container.addItem(this._vmRecommendedConfigurationText);
		}

		return container;
	}

	// TODO - We can remove dummayData input later and use a some other way to pass the values. Once we start implementing the whole page.
	public async updateContent(dummyData: DummyData) {
		await this._assessmentResultText.updateProperties({ "value": constants.ASSESSED_DBS(dummyData.assessmentResult) });
		await this._readyText.updateProperties({ "value": dummyData.ready.toString() });
		await this._needsReviewText.updateProperties({ "value": dummyData.needsReview.toString() });
		await this._notReadyText.updateProperties({ "value": dummyData.notReady.toString() });
		await this._blockersText.updateProperties({ "value": dummyData.blockers.toString() });
		await this._warningsText.updateProperties({ "value": dummyData.warnings.toString() });

		await this._recommendedConfigurationText.updateProperties({ "value": dummyData.skuRecommendation.toString() });
		await this._vmRecommendedConfigurationText.updateProperties({ "value": dummyData.vmRecommendation });

	}

	// TODO - Check this later, if we need to handle this separately.
	public dispose(): void {
		this._disposables.forEach(
			d => { try { d.dispose(); } catch { } });
	}
}

export enum AssessmentResultType {
	READY = 0,
	NEEDS_REVIEW = 1,
	NOT_READY = 2,
	BLOCKERS = 3,
	WARNINGS = 4,
}

// TODO - We can remove this class later and use a some other way to pass the values. Once we start implementing the whole page.
export class DummyData {
	constructor(
		public assessmentResult: number,
		public ready: number, public needsReview: number, public notReady: number,
		public blockers: number, public warnings: number,
		public skuRecommendation: string, public vmRecommendation: string) {
	}
}
