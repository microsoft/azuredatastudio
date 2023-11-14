/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { MigrationStateModel } from '../../models/stateMachine';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationTargetType } from '../../api/utils';
import { SqlMigrationAssessmentResultItem, SqlMigrationImpactedObjectInfo } from '../../service/contracts';

const DialogName = 'SchemaMigrationAssessment';
const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};

export class SchemaMigrationAssessmentDialog {
	private _dialog: azdata.window.Dialog | undefined;
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model: MigrationStateModel;
	private _sourceDatabaseName: string;
	private _assessmentsTable!: azdata.FlexContainer;
	private _assessmentContainer!: azdata.FlexContainer;
	private _assessmentTitle!: azdata.TextComponent;
	private _descriptionText!: azdata.TextComponent;
	private _impactedObjectsTable!: azdata.DeclarativeTableComponent;
	private _impactedObjects!: SqlMigrationImpactedObjectInfo[];
	private _objectDetailsType!: azdata.TextComponent;
	private _objectDetailsName!: azdata.TextComponent;
	private _objectDetailsSample!: azdata.TextComponent;
	private _recommendationText!: azdata.TextComponent;
	private _recommendationTitle!: azdata.TextComponent;
	private _moreInfoTitle!: azdata.TextComponent;
	private _moreInfoText!: azdata.HyperlinkComponent;
	private _recommendation!: azdata.TextComponent;
	private _dbName!: azdata.TextComponent;
	private _assessmentResultsList!: azdata.ListViewComponent;
	private _activeIssues!: SqlMigrationAssessmentResultItem[];
	private _resultComponent!: azdata.Component;
	private _rootContainer!: azdata.FlexContainer;
	private _onSaveCallback: () => Promise<void>;

	constructor(
		model: MigrationStateModel,
		sourceDatabaseName: string,
		onSaveCallback: () => Promise<void>
	) {
		this._model = model;
		this._sourceDatabaseName = sourceDatabaseName;
		this._onSaveCallback = onSaveCallback;
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async (view: azdata.ModelView) => {
			dialog.message = {
				level: azdata.window.MessageLevel.Warning,
				text: constants.SCHEMA_MIGRATION_ASSESSMENT_WARNING_MESSAGE,
			};
			dialog.okButton.hidden = true;
			dialog.cancelButton.label = constants.CLOSE;
			dialog.cancelButton.position = 'left';
			this._disposables.push(
				dialog.cancelButton.onClick(
					async () => { await this._onSaveCallback(); this._isOpen = false; }));
			const flex = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				height: '100%',
				width: '100%'
			}).component();
			flex.addItem(await this._createRootContainer(view), { flex: '1 1 auto' });

			this._disposables.push(view.onClosed(e => {
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			await view.initializeModel(flex);
			await this._loadData();
		});
	}

	public async openDialog(dialogTitle: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				'830px', undefined, undefined, false);

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;
		}
	}

	private async _loadData(): Promise<void> {
		this._activeIssues = this._model._assessmentResults?.databaseAssessments
			.find(r => r.name === this._sourceDatabaseName)?.issues
			.filter(i => i.appliesToMigrationTargetPlatform === MigrationTargetType.SQLDB && constants.SchemaMigrationFailedRulesLookup[i.ruleId] !== undefined)
			.sort((i1, i2) => this.stringCompare(i1.ruleId, i2.ruleId, -1)) ?? [];
		this._dbName.value = this._sourceDatabaseName;
		this._recommendationTitle.value = constants.ISSUES_COUNT(this._activeIssues?.length);
		this._recommendation.value = constants.ISSUES_DETAILS;
		await this._resultComponent.updateCssStyles({
			'display': 'block'
		});

		await this.refreshResults();
	}

	private async _createRootContainer(view: azdata.ModelView): Promise<azdata.Component> {
		this._view = view;

		this._resultComponent = await this.createComponentResult(view);
		this._rootContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%',
			width: '100%'
		}).component();
		this._rootContainer.addItem(this._resultComponent, { flex: '0 0 auto' });

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		return this._rootContainer;
	}

	private async refreshResults(): Promise<void> {
		if (this._activeIssues?.length === 0) {
			/// show no issues here
			await this._assessmentsTable.updateCssStyles({ 'display': 'none', 'border-right': 'none' });
			await this._assessmentContainer.updateCssStyles({ 'display': 'none' });
		} else {
			await this._assessmentContainer.updateCssStyles({ 'display': 'flex' });
			await this._assessmentsTable.updateCssStyles({ 'display': 'flex', 'border-right': 'solid 1px' });
		}
		let assessmentResults: azdata.ListViewOption[] = this._activeIssues
			.map((v, index) => {
				return {
					id: index.toString(),
					label: constants.SchemaMigrationFailedRulesLookup[v.ruleId] ?? '',
					icon: v.databaseRestoreFails ? IconPathHelper.error : undefined,
					ariaLabel: v.databaseRestoreFails ? constants.BLOCKING_ISSUE_ARIA_LABEL(v.checkId) : v.checkId,
				};
			});

		this._assessmentResultsList.options = assessmentResults;
		if (this._assessmentResultsList.options.length) {
			this._assessmentResultsList.selectedOptionId = '0';
		}
	}

	private async createComponentResult(view: azdata.ModelView): Promise<azdata.Component> {
		this._view = view;
		const topContainer = this.createTopContainer();
		const bottomContainer = this.createBottomContainer();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'margin': '32px 0px 0px 18px',
				'overflow-y': 'hidden',
				'display': 'none'
			}
		}).component();

		container.addItem(topContainer, { flex: '0 0 auto' });
		container.addItem(bottomContainer, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'hidden' } });

		return container;
	}

	private createTopContainer(): azdata.FlexContainer {
		const title = this.createTitleComponent();
		const impact = this.createPlatformComponent();
		const recommendation = this.createRecommendationComponent();
		const assessmentResultsTitle = this.createAssessmentResultsTitle();
		const assessmentDetailsTitle = this.createAssessmentDetailsTitle();

		const titleContainer = this._view.modelBuilder.flexContainer().withItems([
		]).withProps({
			CSSStyles: {
				'border-bottom': 'solid 1px',
				'width': '800px'
			}
		}).component();

		titleContainer.addItem(assessmentResultsTitle, {
			flex: '0 0 auto'
		});

		titleContainer.addItem(assessmentDetailsTitle, {
			flex: '0 0 auto'
		});

		const container = this._view.modelBuilder.flexContainer().withItems([title, impact, recommendation, titleContainer]).withLayout({
			flexFlow: 'column'
		}).component();

		return container;
	}

	private createBottomContainer(): azdata.FlexContainer {

		this._assessmentsTable = this.createImpactedObjectsTable();
		this._assessmentContainer = this.createAssessmentContainer();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			height: '100%'
		}).withProps({
			CSSStyles: {
				'height': '100%'
			}
		}).component();

		container.addItem(this._assessmentsTable, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		container.addItem(this._assessmentContainer, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'auto' } });
		return container;
	}

	private createAssessmentContainer(): azdata.FlexContainer {
		const title = this.createAssessmentTitle();
		const bottomContainer = this.createDescriptionContainer();
		const container = this._view.modelBuilder.flexContainer()
			.withItems([title, bottomContainer])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin-left': '24px' } })
			.component();

		return container;
	}

	private createAssessmentTitle(): azdata.TextComponent {
		this._assessmentTitle = this._view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin-top': '12px',
					'height': '48px',
					'width': '540px',
					'border-bottom': 'solid 1px'
				}
			}).component();

		return this._assessmentTitle;
	}

	private createDescriptionContainer(): azdata.FlexContainer {
		const description = this.createDescription();
		const impactedObjects = this.createImpactedObjectsDescription();
		const container = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withProps({ CSSStyles: { 'height': '100%' } })
			.component();
		container.addItem(description, { flex: '0 0 auto', CSSStyles: { 'width': '200px', 'margin-right': '35px' } });
		container.addItem(impactedObjects, { flex: '0 0 auto', CSSStyles: { 'width': '280px' } });

		return container;
	}

	private createImpactedObjectsDescription(): azdata.FlexContainer {
		const impactedObjectsTitle = this._view.modelBuilder.text().withProps({
			value: constants.IMPACTED_OBJECTS,
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'width': '280px',
				'margin': '10px 0px 0px 0px',
			}
		}).component();

		const rowStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid'
		};

		this._impactedObjectsTable = this._view.modelBuilder.declarativeTable().withProps(
			{
				ariaLabel: constants.IMPACTED_OBJECTS,
				enableRowSelection: true,
				width: '100%',
				columns: [
					{
						displayName: constants.TYPE,
						valueType: azdata.DeclarativeDataType.string,
						width: '120px',
						isReadOnly: true,
						headerCssStyles: headerLeft,
						rowCssStyles: rowStyle
					},
					{
						displayName: constants.NAME,
						valueType: azdata.DeclarativeDataType.string,
						width: '130px',
						isReadOnly: true,
						headerCssStyles: headerLeft,
						rowCssStyles: rowStyle
					},
				],
				dataValues: [[{ value: '' }, { value: '' }]],
				CSSStyles: { 'margin-top': '12px' }
			}
		).component();

		this._disposables.push(this._impactedObjectsTable.onRowSelected((e) => {
			const impactedObject = e.row > -1 ? this._impactedObjects[e.row] : undefined;
			this.refreshImpactedObject(impactedObject);
		}));

		const objectDetailsTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.OBJECT_DETAILS,
				CSSStyles: {
					...styles.LIGHT_LABEL_CSS,
					'margin': '12px 0px 0px 0px',
				}
			}).component();
		const objectDescriptionStyle = {
			...styles.BODY_CSS,
			'margin': '5px 0px 0px 0px',
			'word-wrap': 'break-word'
		};
		this._objectDetailsType = this._view.modelBuilder.text()
			.withProps({
				value: constants.TYPES_LABEL,
				CSSStyles: objectDescriptionStyle
			}).component();

		this._objectDetailsName = this._view.modelBuilder.text()
			.withProps({
				value: constants.NAMES_LABEL,
				CSSStyles: objectDescriptionStyle
			}).component();

		this._objectDetailsSample = this._view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: objectDescriptionStyle
			}).component();

		const container = this._view.modelBuilder.flexContainer()
			.withItems([
				impactedObjectsTitle,
				this._impactedObjectsTable,
				objectDetailsTitle,
				this._objectDetailsType,
				this._objectDetailsName,
				this._objectDetailsSample])
			.withLayout({ flexFlow: 'column' })
			.component();

		return container;
	}

	private createDescription(): azdata.FlexContainer {
		const LABEL_CSS = {
			...styles.LIGHT_LABEL_CSS,
			'width': '200px',
			'margin': '12px 0 0'
		};
		const textStyle = {
			...styles.BODY_CSS,
			'width': '200px',
			'word-wrap': 'break-word'
		};
		const descriptionTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.DESCRIPTION,
				CSSStyles: LABEL_CSS
			}).component();
		this._descriptionText = this._view.modelBuilder.text()
			.withProps({
				CSSStyles: textStyle
			}).component();

		const recommendationTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.RECOMMENDATION,
				CSSStyles: LABEL_CSS
			}).component();
		this._recommendationText = this._view.modelBuilder.text()
			.withProps({
				CSSStyles: textStyle
			}).component();

		this._moreInfoTitle = this._view.modelBuilder.text()
			.withProps({
				value: constants.MORE_INFO,
				CSSStyles: LABEL_CSS
			}).component();
		this._moreInfoText = this._view.modelBuilder.hyperlink()
			.withProps({
				label: '',
				url: '',
				CSSStyles: textStyle,
				ariaLabel: constants.MORE_INFO,
				showLinkIcon: true
			}).component();

		const container = this._view.modelBuilder.flexContainer()
			.withItems([descriptionTitle,
				this._descriptionText,
				recommendationTitle,
				this._recommendationText,
				this._moreInfoTitle,
				this._moreInfoText])
			.withLayout({ flexFlow: 'column' })
			.component();

		return container;
	}

	private createTitleComponent(): azdata.TextComponent {
		return this._view.modelBuilder.text()
			.withProps({
				value: constants.TARGET_PLATFORM,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0 0 4px 0'
				}
			}).component();
	}

	private createPlatformComponent(): azdata.TextComponent {
		return this._view.modelBuilder.text()
			.withProps({
				value: constants.SUMMARY_SQLDB_TYPE,
				CSSStyles: { ...styles.PAGE_SUBTITLE_CSS }
			}).component();
	}

	private createRecommendationComponent(): azdata.TextComponent {
		this._dbName = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-bottom': '8px',
				'font-weight': '700'
			}
		}).component();

		return this._dbName;
	}

	private createAssessmentResultsTitle(): azdata.TextComponent {
		this._recommendationTitle = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin': '0 8px 4px 0',
				'width': '220px',
			}
		}).component();

		return this._recommendationTitle;
	}

	private createAssessmentDetailsTitle(): azdata.TextComponent {
		this._recommendation = this._view.modelBuilder.text().withProps({
			value: constants.WARNINGS_DETAILS,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin': '0 0 4px 24px',
				'width': '200px',
			}
		}).component();

		return this._recommendation;
	}

	private createImpactedObjectsTable(): azdata.FlexContainer {

		this._assessmentResultsList = this._view.modelBuilder.listView().withProps({
			width: '200px',
			options: []
		}).component();

		this._disposables.push(this._assessmentResultsList.onDidClick(async (e: azdata.ListViewClickEvent) => {
			const selectedIssue = this._activeIssues[parseInt(this._assessmentResultsList.selectedOptionId!)];
			await this.refreshAssessmentDetails(selectedIssue);
		}));

		const container = this._view.modelBuilder.flexContainer()
			.withItems([this._assessmentResultsList])
			.withLayout({
				flexFlow: 'column',
				height: '100%'
			})
			.withProps({ CSSStyles: { 'border-right': 'solid 1px' } })
			.component();

		return container;
	}

	public refreshImpactedObject(impactedObject?: SqlMigrationImpactedObjectInfo): void {
		this._objectDetailsType.value = constants.IMPACT_OBJECT_TYPE(impactedObject?.objectType);
		this._objectDetailsName.value = constants.IMPACT_OBJECT_NAME(impactedObject?.name);
		this._objectDetailsSample.value = impactedObject?.impactDetail || '';
	}

	public async refreshAssessmentDetails(selectedIssue?: SqlMigrationAssessmentResultItem): Promise<void> {
		await this._assessmentTitle.updateProperty('value', selectedIssue?.checkId || '');
		await this._descriptionText.updateProperty('value', selectedIssue?.description || '');
		await this._recommendationText.updateProperty('value', selectedIssue?.message || constants.NA);

		if (selectedIssue?.helpLink) {
			await this._moreInfoTitle.updateProperty('display', 'flex');
			await this._moreInfoText.updateProperties({
				'display': 'flex',
				'url': selectedIssue?.helpLink || '',
				'label': selectedIssue?.displayName || '',
				'ariaLabel': selectedIssue?.displayName || '',
				'showLinkIcon': true
			});
		} else {
			await this._moreInfoTitle.updateProperty('display', 'none');
			await this._moreInfoText.updateProperties({
				'display': 'none',
				'url': '',
				'label': '',
				'ariaLabel': '',
				'showLinkIcon': false
			});
		}

		this._impactedObjects = selectedIssue?.impactedObjects || [];
		await this._impactedObjectsTable.setDataValues(
			this._impactedObjects.map(
				(object) => [{ value: object.objectType }, { value: object.name }]));

		this._impactedObjectsTable.selectedRow = this._impactedObjects?.length > 0 ? 0 : -1;
	}

	private stringCompare(string1: string | undefined, string2: string | undefined, sortDir: number): number {
		if (!string1) {
			return sortDir;
		} else if (!string2) {
			return -sortDir;
		}
		return string1.localeCompare(string2) * -sortDir;
	}
}
