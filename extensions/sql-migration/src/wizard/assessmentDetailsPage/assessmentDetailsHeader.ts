/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { MigrationTargetType, hasRecommendations } from '../../api/utils';
import * as utils from '../../api/utils';
import { IssueCategory } from '../../constants/helper';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { SkuRecommendationResultsDialog } from '../../dialog/skuRecommendationResults/skuRecommendationResultsDialog';
import { GenerateProvisioningScriptDialog } from '../../dialog/skuRecommendationResults/GenerateProvisioningScriptDialog';
import { logError, TelemetryViews } from '../../telemetry';

interface IActionMetadata {
	title?: string,
	value?: string
}

// Class defining header section of assessment details page
export class AssessmentDetailsHeader {
	private _view!: azdata.ModelView;
	private _valueContainers: azdata.TextComponent[] = [];
	private _targetSelectionDropdown!: azdata.DropDownComponent;
	private _targetTypeContainer!: azdata.FlexContainer;
	private _noTargetSelectedContainer!: azdata.FlexContainer;
	private _headerCardsContainer!: azdata.FlexContainer;
	private _viewDetailsLink!: azdata.HyperlinkComponent;
	private _generateTemplateLink!: azdata.HyperlinkComponent;
	private _linksContainer!: azdata.FlexContainer;
	private _separator!: azdata.TextComponent;

	// public getter for target type selection drop down.
	public get targetTypeDropdown() {
		return this._targetSelectionDropdown;
	}

	// public getter for target type container.
	public get targetTypeContainer() {
		return this._targetTypeContainer;
	}


	// public getter for noTargetSelectedContainer.
	public get noTargetSelectedContainer() {
		return this._noTargetSelectedContainer;
	}

	//public getter for headerCardsContainer.
	public get headerCardsContainer() {
		return this._headerCardsContainer;
	}

	constructor(public migrationStateModel: MigrationStateModel, private _readonly: boolean = false) { }

	// function that creates the component for header section of assessment details page.
	public createAssessmentDetailsHeader(view: azdata.ModelView): azdata.Component {
		this._view = view;
		const headerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withProps({
			CSSStyles: {
				'margin-left': '15px'
			}
		}).component();

		this._targetTypeContainer = this.createTargetTypeContainer();

		this._noTargetSelectedContainer = this.createTargetSelectedContainer();

		this._headerCardsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		// List of card labels displayed in header section of Assessment details page.
		const assessmentHeaderLabels = [];
		if (!this._readonly) {
			assessmentHeaderLabels.push({
				title: constants.RECOMMENDED_CONFIGURATION
			})
		}
		assessmentHeaderLabels.push({
			title: constants.DATABASES_ASSESSED_LABEL
		}, {
			title: constants.MIGRATION_TIME_LABEL
		});

		// create individual card component for each property in above list
		this._headerCardsContainer.addItems(assessmentHeaderLabels.map(l => this.createCard(l)));

		headerContainer.addItems([this._targetTypeContainer, this._noTargetSelectedContainer, this._headerCardsContainer]);

		return headerContainer;
	}

	// function creating ui for no target selected container.
	private createTargetSelectedContainer(): azdata.FlexContainer {
		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withProps({
			CSSStyles: {
				'margin-left': '50px',
				'margin-top': '50px'
			}
		}).component();

		const emptyStateImage = this._view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.emptyState,
			iconHeight: 200,
			iconWidth: 200,
			width: 200,
			height: 200,
			CSSStyles: {
				'opacity': '50%',
				'margin': '3% auto',
				'filter': 'drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.25))'
			}
		}).component();

		const noTargetSelectedText = this._view.modelBuilder.text().withProps({
			value: constants.NO_TARGET_SELECTED_LABEL,
			width: 210,
			height: 34,
			CSSStyles: {
				...styles.NOTE_CSS,
				'margin': 'auto',
				'text-align': 'center'
			}
		}).component();

		container.addItems([emptyStateImage, noTargetSelectedText]);
		return container;
	}

	// function defining ui for card component in ui section.
	private createCard(linkMetaData: IActionMetadata) {

		const cardContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: 190,
			height: 75
		}).withProps({
			CSSStyles: {
				...styles.CARD_CSS,
			}
		}).component();

		const cardHeading = this._view.modelBuilder.text().withProps({
			value: linkMetaData.title,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0px'
			},
		}).component();

		const cardText = this._view.modelBuilder.text().withProps({
			value: linkMetaData.value,
			CSSStyles: {
				...styles.LABEL_CSS,
				'overflow-wrap': 'break-word'
			},
		}).component();

		cardContainer.addItems([cardHeading, cardText]);

		if (linkMetaData.title === constants.RECOMMENDED_CONFIGURATION) {
			this._linksContainer = this._view.modelBuilder.flexContainer().withProps({
				CSSStyles: {
					'display': 'flex',
					'flex-direction': 'row',
					'width': '190px'
				}
			}).component();


			this._viewDetailsLink = this._view.modelBuilder.hyperlink().withProps({
				label: constants.VIEW_DETAILS,
				url: '',
				height: 18,
				CSSStyles: styles.VIEW_DETAILS_GENERATE_TEMPLATE_LINK
			}).component();


			this._viewDetailsLink.onDidClick(async () => {
				if (hasRecommendations(this.migrationStateModel)) {
					const skuRecommendationResultsDialog = new SkuRecommendationResultsDialog(this.migrationStateModel, this.migrationStateModel._targetType);
					await skuRecommendationResultsDialog.openDialog(
						this.migrationStateModel._targetType,
						this.migrationStateModel._skuRecommendationResults.recommendations
					);
				}
			});

			this._generateTemplateLink = this._view.modelBuilder.hyperlink().withProps({
				label: constants.GENERATE_ARM_TEMPLATE,
				url: '',
				height: 18,
				CSSStyles: styles.VIEW_DETAILS_GENERATE_TEMPLATE_LINK
			}).component();

			try {
				this._generateTemplateLink.onDidClick(async () => {
					if (hasRecommendations(this.migrationStateModel)) {
						const generateProvisioningScriptDialog = new GenerateProvisioningScriptDialog(this.migrationStateModel, this.migrationStateModel._targetType);
						await generateProvisioningScriptDialog.openDialog();
					}
				});
			}
			catch (e) {
				logError(TelemetryViews.ProvisioningScriptWizard, 'ProvisioningScriptDialogOpenError', e);
			}

			this._separator = this._view.modelBuilder.text().withProps({
				value: "|",
				height: 18,
				CSSStyles: styles.SEPARATOR,
			}).component();

			this._linksContainer.addItems([this._viewDetailsLink, this._separator, this._generateTemplateLink]);
			cardContainer.addItem(this._linksContainer);
		}

		this._valueContainers.push(cardText);
		return cardContainer;
	}

	// function to populate the values of properties displayed in the cards.
	public async populateAssessmentDetailsHeader(migrationStateModel: MigrationStateModel): Promise<void> {
		// this value is populated to handle the case when user selects a target type and want to resume later.
		this._targetSelectionDropdown.value = this.getTargetTypeBasedOnModel(migrationStateModel._targetType);

		const assessmentHeaderValues: { value: string | string[] | undefined; }[] = [];
		if (!this._readonly) {
			const recommendedConfigurations = await utils.getRecommendedConfiguration(migrationStateModel._targetType, migrationStateModel);
			let configurationValue = recommendedConfigurations[0] ?? "--";
			if (migrationStateModel._targetType === MigrationTargetType.SQLVM && recommendedConfigurations?.length > 1) {
				configurationValue = recommendedConfigurations[0] + "\n" + recommendedConfigurations[1];
			}
			assessmentHeaderValues.push({
				value: configurationValue
			})

			if (configurationValue !== "--") {
				await this._viewDetailsLink.updateCssStyles({ 'display': 'block' });
				await this._generateTemplateLink.updateCssStyles({ 'display': 'block' });
				await this._separator.updateCssStyles({ 'display': 'block' });
			}
		}
		assessmentHeaderValues.push(
			{
				value: String(migrationStateModel._assessmentResults?.databaseAssessments?.length)
			},
			{
				value: String(migrationStateModel._assessmentResults.databaseAssessments.filter((db) => db.issues.filter(issue => issue.appliesToMigrationTargetPlatform === migrationStateModel._targetType && issue.issueCategory === IssueCategory.Issue)?.length === 0)?.length)
			});

		// iterating over each value container and filling it with the corresponding text.
		let index = 0;
		this._valueContainers.forEach((valueContainer) =>
			valueContainer.value = assessmentHeaderValues[index++].value);
	}

	// function that create target selection dropdown
	private createTargetTypeContainer(): azdata.FlexContainer {
		let targetTypes = [constants.SUMMARY_SQLDB_TYPE, constants.SUMMARY_MI_TYPE, constants.SUMMARY_VM_TYPE];
		if (this._readonly) {
			const targetPlatforms = new Set<string>();
			const issues = this.migrationStateModel._assessmentResults?.issues;
			issues.forEach((issue) => {
				targetPlatforms.add(issue.appliesToMigrationTargetPlatform);
			});

			for (let i = 0; i < this.migrationStateModel._assessmentResults?.databaseAssessments.length; i++) {
				const issues = this.migrationStateModel._assessmentResults?.databaseAssessments[i].issues;
				issues.forEach((issue) => {
					targetPlatforms.add(issue.appliesToMigrationTargetPlatform);
				});
			}

			targetTypes = Array.from(targetPlatforms).sort().map(v => {
				switch (v) {
					case MigrationTargetType.SQLDB: return constants.SUMMARY_SQLDB_TYPE;
					case MigrationTargetType.SQLMI: return constants.SUMMARY_MI_TYPE;
					case MigrationTargetType.SQLVM: return constants.SUMMARY_VM_TYPE;
					default: return v.toString();
				}
			});
		}

		const targetTypeContainer = this._view.modelBuilder.flexContainer().component();

		const selectLabel = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_TARGET_LABEL,
			CSSStyles: {
				...styles.LABEL_CSS
			},
		}).component();

		this._targetSelectionDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.AZURE_SQL_TARGET,
			placeholder: constants.SELECT_TARGET_LABEL,
			values: targetTypes,
			width: 250,
			editable: true,
			CSSStyles: {
				'margin-top': '-0.2em',
				'margin-left': '10px'
			},
		}).component();

		targetTypeContainer.addItem(selectLabel, { flex: 'none' });
		targetTypeContainer.addItem(this._targetSelectionDropdown, { flex: 'none' });

		return targetTypeContainer;
	}

	// function to get target type value based on model value.
	private getTargetTypeBasedOnModel(targetType: MigrationTargetType): string {
		switch (targetType) {
			case MigrationTargetType.SQLDB:
				return constants.SUMMARY_SQLDB_TYPE;
			case MigrationTargetType.SQLVM:
				return constants.SUMMARY_VM_TYPE;
			case MigrationTargetType.SQLMI:
				return constants.SUMMARY_MI_TYPE;
			default:
				throw new Error('Unsupported type');
		}
	}
}
