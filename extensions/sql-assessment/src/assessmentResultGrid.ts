/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import { AssessmentType } from './engine';
import { LocalizedStrings } from './localized';
const localize = nls.loadMessageBundle();

export class AssessmentResultGrid implements vscode.Disposable {

	private table!: azdata.TableComponent;
	private rootContainer!: azdata.FlexContainer;
	private toDispose: vscode.Disposable[] = [];
	private detailsPanel!: azdata.FlexContainer;
	private dataItems!: azdata.SqlAssessmentResultItem[];

	private tagsPlaceholder!: azdata.TextComponent;
	private checkNamePlaceholder!: azdata.TextComponent;
	private checkDescriptionPlaceholder!: azdata.TextComponent;
	private clickHereLabel!: azdata.HyperlinkComponent;
	private asmtMessagePlaceholder!: azdata.TextComponent;
	private asmtMessageDiv!: azdata.DivContainer;
	private descriptionCaption!: azdata.TextComponent;

	private asmtType!: AssessmentType;
	private targetTypeIcon: { [targetType: number]: azdata.IconColumnCellValue };

	private readonly checkIdColOrder = 5;
	private readonly targetColOrder = 1;
	private readonly messageColOrder = 3;

	public get component(): azdata.Component {
		return this.rootContainer;
	}

	public constructor(view: azdata.ModelView, extensionContext: vscode.ExtensionContext) {
		const headerCssClass = 'no-borders align-with-header';
		this.targetTypeIcon = {
			[azdata.sqlAssessment.SqlAssessmentTargetType.Database]: {
				icon: {
					dark: extensionContext.asAbsolutePath('resources/dark/database.svg'),
					light: extensionContext.asAbsolutePath('resources/light/database.svg')
				},
				title: localize('databaseIconLabel', "Database")
			},
			[azdata.sqlAssessment.SqlAssessmentTargetType.Server]: {
				icon: {
					dark: extensionContext.asAbsolutePath('resources/dark/server.svg'),
					light: extensionContext.asAbsolutePath('resources/light/server.svg')
				},
				title: localize('serverIconLabel', "Server")
			}
		};

		this.table = view.modelBuilder.table()
			.withProps({
				data: [],
				columns: [
					{
						value: 'targetType',
						name: '',
						type: azdata.ColumnType.icon,
						width: 10,
						headerCssClass: headerCssClass,
						toolTip: localize('asmt.column.targetType', "Target Type"),
						resizable: false,
					},
					{ value: LocalizedStrings.TARGET_COLUMN_NAME, headerCssClass: headerCssClass, width: 125 },
					{ value: LocalizedStrings.SEVERITY_COLUMN_NAME, headerCssClass: headerCssClass, width: 100 },
					{ value: LocalizedStrings.MESSAGE_COLUMN_NAME, headerCssClass: headerCssClass, width: 900 },
					{ value: LocalizedStrings.TAGS_COLUMN_NAME, headerCssClass: headerCssClass, width: 200 },
					{ value: LocalizedStrings.CHECKID_COLUMN_NAME, headerCssClass: headerCssClass, width: 80 }
				],
				width: '100%',
				height: '100px',
				headerFilter: true
			}).component();

		this.toDispose.push(
			this.table.onRowSelected(async () => {
				if (this.table.selectedRows?.length !== 1) {
					return;
				}
				await this.showDetails(this.table.selectedRows[0]);
			}));

		this.rootContainer = view.modelBuilder.flexContainer()
			.withItems([this.table], {
				flex: '1 1 auto',
				order: 1
			})
			.withLayout(
				{
					flexFlow: 'column',
					height: '100%',
				})
			.component();

		this.detailsPanel = this.createDetailsPanel(view);

		this.rootContainer.addItem(this.detailsPanel, {
			flex: '0 0 200px',
			order: 2,
			CSSStyles: {
				'visibility': 'hidden'
			}
		});
	}

	dispose() {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	public async displayResult(asmtResult: azdata.SqlAssessmentResult, method: AssessmentType) {
		this.asmtType = method;
		this.dataItems = this.filterOutNotSupportedKind(asmtResult.items);
		await this.table.updateProperties({
			'data': this.dataItems.map(item => this.convertToDataView(item))
		});
		this.rootContainer.setLayout({
			flexFlow: 'column',
			height: '100%',
		});
		this.rootContainer.setItemLayout(this.table, {
			flex: '1 1 auto',
			CSSStyles: {
				'height': '100%',
				'border-bottom': '3px solid rgb(221, 221, 221)'
			}
		});

		await this.table.updateProperties({
			'height': '100%'
		});
		if (this.dataItems.length > 0) {
			this.table.selectedRows = [0];
		} else {
			await this.detailsPanel.updateCssStyles({
				'visibility': 'hidden'
			});
		}
	}

	// we need to filter out warnings and error results since we don't have an appropriate way of displaying such messages.
	// have to redone this once required functionality will be added to the core.
	private filterOutNotSupportedKind(items: azdata.SqlAssessmentResultItem[]): azdata.SqlAssessmentResultItem[] {
		if (this.asmtType === AssessmentType.AvailableRules) {
			return items;
		}

		return items.filter(i => i.kind === azdata.sqlAssessment.SqlAssessmentResultItemKind.RealResult);
	}

	public async appendResult(asmtResult: azdata.SqlAssessmentResult): Promise<void> {
		let filteredValues = this.filterOutNotSupportedKind(asmtResult.items);
		if (this.dataItems) {
			this.dataItems.push(...filteredValues);

		}
		await this.table.appendData(filteredValues.map(item => this.convertToDataView(item)));
	}

	private async showDetails(rowNumber: number) {
		const selectedRowValues = this.table.data[rowNumber];
		const asmtResultItem = this.asmtType === AssessmentType.InvokeAssessment
			? this.dataItems.find(item =>
				item.targetName === selectedRowValues[this.targetColOrder]
				&& item.checkId === selectedRowValues[this.checkIdColOrder]
				&& item.message === selectedRowValues[this.messageColOrder])
			: this.dataItems.find(item =>
				item.targetName === selectedRowValues[this.targetColOrder]
				&& item.checkId === selectedRowValues[this.checkIdColOrder]);

		if (!asmtResultItem) {
			return;
		}
		this.checkNamePlaceholder.value = asmtResultItem.displayName;
		this.checkDescriptionPlaceholder.value = asmtResultItem.description;
		this.clickHereLabel.url = asmtResultItem.helpLink;
		this.tagsPlaceholder.value = asmtResultItem.tags?.join(', ');
		this.asmtMessagePlaceholder.value = asmtResultItem.message;

		if (this.asmtType === AssessmentType.InvokeAssessment) {
			this.asmtMessageDiv.display = 'block';
			this.descriptionCaption.display = 'block';
		} else {
			this.asmtMessageDiv.display = 'none';
			this.descriptionCaption.display = 'none';
		}

		this.detailsPanel.updateCssStyles({
			'visibility': 'visible'
		});
	}

	private createDetailsPanel(view: azdata.ModelView): azdata.FlexContainer {

		const root = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				height: '200px',
			}).withProps({
				CSSStyles: {
					'padding': '0px 10px'
				}
			}).component();
		const cssNoMarginFloatLeft = { 'margin': '0px', 'float': 'left' };
		const cssBlockCaption = { 'font-weight': 'bold', 'margin': '0px', 'display': 'block', 'padding-top': '5px' };
		const flexSettings = '0 1 auto';


		this.checkNamePlaceholder = view.modelBuilder.text().withProps({
			CSSStyles: { ...cssNoMarginFloatLeft, 'font-weight': 'bold', 'font-size': '16px', 'padding-bottom': '5px', 'display': 'block' }
		}).component();
		this.checkDescriptionPlaceholder = view.modelBuilder.text().withProps({
			CSSStyles: { ...cssNoMarginFloatLeft, 'padding-right': '2px' }
		}).component();
		this.clickHereLabel = view.modelBuilder.hyperlink().withProps({
			label: localize('asmt.details.clickHere', "Click here"),
			url: '',
			CSSStyles: cssNoMarginFloatLeft
		}).component();
		const toLearnMoreText = view.modelBuilder.text().withProps({
			CSSStyles: { ...cssNoMarginFloatLeft, 'padding-left': '2px' },
			value: localize('asmt.details.toLearnMore', " to learn more.")
		}).component();
		const tagsCaption = view.modelBuilder.text().withProps({
			CSSStyles: cssBlockCaption,
			value: LocalizedStrings.TAGS_COLUMN_NAME
		}).component();
		this.tagsPlaceholder = view.modelBuilder.text().withProps({
			CSSStyles: cssNoMarginFloatLeft
		}).component();

		this.asmtMessagePlaceholder = view.modelBuilder.text().withProps({
			CSSStyles: cssNoMarginFloatLeft
		}).component();

		this.descriptionCaption = view.modelBuilder.text().withProps({
			CSSStyles: cssBlockCaption,
			value: localize('asmt.details.ruleDescription', "Rule Description")
		}).component();

		root.addItem(
			this.checkNamePlaceholder, { flex: flexSettings }
		);

		this.asmtMessageDiv = view.modelBuilder.divContainer().withItems([
			view.modelBuilder.text().withProps({
				CSSStyles: cssBlockCaption,
				value: localize('asmt.details.recommendation', "Recommendation")
			}).component(),
			this.asmtMessagePlaceholder
		]).component();

		root.addItem(
			this.asmtMessageDiv,
			{ flex: flexSettings }
		);


		root.addItem(
			view.modelBuilder.divContainer().withItems([
				this.descriptionCaption,
				this.checkDescriptionPlaceholder,
				this.clickHereLabel,
				toLearnMoreText
			]).component(),
			{ flex: flexSettings }
		);

		root.addItem(
			view.modelBuilder.divContainer().withItems([
				tagsCaption,
				this.tagsPlaceholder
			]).component(),
			{ flex: flexSettings }
		);

		return root;
	}

	private clearOutDefaultRuleset(tags: string[]): string[] {
		let idx = tags.findIndex(item => item.toUpperCase() === 'DEFAULTRULESET');
		if (idx > -1) {
			tags.splice(idx, 1);
		}
		return tags;
	}

	private convertToDataView(asmtResult: azdata.SqlAssessmentResultItem): any[] {
		return [
			this.targetTypeIcon[asmtResult.targetType],
			asmtResult.targetName,
			asmtResult.level,
			this.asmtType === AssessmentType.InvokeAssessment ? asmtResult.message : asmtResult.displayName,
			this.clearOutDefaultRuleset(asmtResult.tags),
			asmtResult.checkId
		];
	}
}
