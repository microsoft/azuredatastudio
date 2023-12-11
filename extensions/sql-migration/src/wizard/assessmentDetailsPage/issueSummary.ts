/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as vscode from 'vscode';
import { SqlMigrationAssessmentResultItem, SqlMigrationImpactedObjectInfo } from '../../service/contracts';

const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};

// Creates Issue/Warning summary container
export class IssueSummary {
	private _view!: azdata.ModelView;
	private _recommendationText!: azdata.TextComponent;
	private _descriptionText!: azdata.TextComponent;
	private _moreInfoTitle!: azdata.TextComponent;
	private _moreInfoText!: azdata.HyperlinkComponent;
	private _impactedObjects!: SqlMigrationImpactedObjectInfo[];
	private _objectDetailsType!: azdata.TextComponent;
	private _objectDetailsName!: azdata.TextComponent;
	private _objectDetailsSample!: azdata.TextComponent;
	private _impactedObjectsTable!: azdata.DeclarativeTableComponent;
	private _disposables: vscode.Disposable[] = [];

	//create issue summary ui
	public createIssueSummary(view: azdata.ModelView): azdata.FlexContainer {
		this._view = view;
		const bottomContainer = this.createDescriptionContainer();
		const container = this._view.modelBuilder.flexContainer()
			.withItems([bottomContainer])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin-left': '10px' } })
			.component();

		return container;
	}

	private createDescriptionContainer(): azdata.FlexContainer {
		const description = this.createDescription();
		const impactedObjects = this.createImpactedObjectsDescription();
		const container = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withProps({ CSSStyles: { 'height': '100%' } })
			.component();
		container.addItem(description, { flex: '0 0 auto', CSSStyles: { 'width': '200px', 'margin-right': '35px' } });
		container.addItem(impactedObjects, { flex: '0 0 auto', CSSStyles: { 'width': '180px' } });

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

	private createImpactedObjectsDescription(): azdata.FlexContainer {
		const impactedObjectsTitle = this._view.modelBuilder.text().withProps({
			value: constants.IMPACTED_OBJECTS,
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'width': '180px',
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
					'margin': '12px 0px 0px 0px'
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

	public refreshImpactedObject(impactedObject?: SqlMigrationImpactedObjectInfo): void {
		this._objectDetailsType.value = constants.IMPACT_OBJECT_TYPE(impactedObject?.objectType);
		this._objectDetailsName.value = constants.IMPACT_OBJECT_NAME(impactedObject?.name);
		this._objectDetailsSample.value = impactedObject?.impactDetail || '';
	}

	//refresh issue summary values.
	public async refreshAssessmentDetailsAsync(selectedIssue?: SqlMigrationAssessmentResultItem): Promise<void> {
		this._descriptionText.value = selectedIssue?.description ?? '';
		this._recommendationText.value = selectedIssue?.message ?? constants.NA;

		if (selectedIssue?.helpLink) {
			this._moreInfoTitle.display = 'flex';
			await this._moreInfoText.updateProperties({
				'display': 'flex',
				'url': selectedIssue?.helpLink || '',
				'label': selectedIssue?.displayName || '',
				'ariaLabel': selectedIssue?.displayName || '',
				'showLinkIcon': true
			});
		} else {
			this._moreInfoTitle.display = 'none';
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
}
