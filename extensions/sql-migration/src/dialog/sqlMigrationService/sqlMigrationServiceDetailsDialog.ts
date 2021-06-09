// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData } from '../../api/azure';
import { IconPathHelper } from '../../constants/iconPathHelper';
import * as constants from '../../constants/strings';
import { MigrationContext } from '../../models/migrationLocalStorage';

const INFO_BALLOON_SIZE = '12px';
const INFO_BALLOON_MARGIN = '3px 0 0 3px';
const CONTROL_MARGIN = '10px';
const COLUMN_WIDTH = '50px';
const STRETCH_WIDTH = '100%';
const LABEL_MARGIN = '0 10px 0 10px';
const VALUE_MARGIN = '0 10px 10px 10px';
const NO_MARGIN = '0';
const ICON_SIZE = '28px';
const TITLE_FONT_SIZE = '14px';
const DESCRIPTION_FONT_SIZE = '10px';
const FONT_SIZE = '13px';
const FONT_WEIGHT_BOLD = 'bold';

export class SqlMigrationServiceDetailsDialog {

	private _dialog: azdata.window.Dialog;
	private _migrationServiceAuthKeyTable!: azdata.DeclarativeTableComponent;

	constructor(private migrationContext: MigrationContext) {
		this._dialog = azdata.window.createModelViewDialog(
			'',
			'SqlMigrationServiceDetailsDialog',
			580,
			'flyout');
	}

	async initialize(): Promise<void> {
		this._dialog.registerContent(
			async (view: azdata.ModelView) => await this.createServiceContent(
				view,
				this.migrationContext));

		this._dialog.okButton.label = constants.SQL_MIGRATION_SERVICE_DETAILS_BUTTON_LABEL;
		this._dialog.okButton.focused = true;
		this._dialog.cancelButton.hidden = true;

		azdata.window.openDialog(this._dialog);
	}

	private async createServiceContent(view: azdata.ModelView, migrationContext: MigrationContext): Promise<void> {
		this._migrationServiceAuthKeyTable = this._createIrTable(view);
		const serviceNode = (await getSqlMigrationServiceMonitoringData(
			migrationContext.azureAccount,
			migrationContext.subscription,
			migrationContext.controller.properties.resourceGroup,
			migrationContext.controller.location,
			migrationContext.controller.name
		));
		const serviceNodeName = serviceNode.nodes?.map(node => node.nodeName).join(', ')
			|| constants.SQL_MIGRATION_SERVICE_DETAILS_STATUS_UNAVAILABLE;

		const flexContainer = view.modelBuilder
			.flexContainer()
			.withItems([
				this._createHeading(view, migrationContext),
				view.modelBuilder
					.separator()
					.withProps({ width: STRETCH_WIDTH, })
					.component(),
				this._createTextItem(view, constants.SUBSCRIPTION, LABEL_MARGIN),
				this._createTextItem(view, migrationContext.subscription.name, VALUE_MARGIN),
				this._createTextItem(view, constants.LOCATION, LABEL_MARGIN),
				this._createTextItem(view, migrationContext.controller.location.toUpperCase(), VALUE_MARGIN),
				this._createTextItem(view, constants.RESOURCE_GROUP, LABEL_MARGIN),
				this._createTextItem(view, migrationContext.controller.properties.resourceGroup, VALUE_MARGIN),
				this._createTextItem(view, constants.SQL_MIGRATION_SERVICE_DETAILS_IR_LABEL, LABEL_MARGIN),
				this._createTextItem(view, serviceNodeName, VALUE_MARGIN),
				this._createInfoTextItem(
					view,
					constants.SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_LABEL,
					constants.SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_TITLE,
					LABEL_MARGIN),
				this._migrationServiceAuthKeyTable,
			])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'padding': CONTROL_MARGIN } })
			.component();

		await view.initializeModel(flexContainer);
		return await this._refreshAuthTable(view, migrationContext);
	}

	private _createHeading(view: azdata.ModelView, migrationContext: MigrationContext): azdata.FlexContainer {
		return view.modelBuilder
			.flexContainer()
			.withItems([
				view.modelBuilder
					.image()
					.withProps({
						iconPath: IconPathHelper.migrationService,
						iconHeight: ICON_SIZE,
						iconWidth: ICON_SIZE,
						height: ICON_SIZE,
						width: ICON_SIZE,
					})
					.withProps({ CSSStyles: { 'margin-right': CONTROL_MARGIN } })
					.component(),
				view.modelBuilder
					.flexContainer()
					.withItems([
						view.modelBuilder
							.text()
							.withProps({
								value: migrationContext.controller.name,
								CSSStyles: {
									'font-size': TITLE_FONT_SIZE,
									'font-weight': FONT_WEIGHT_BOLD,
									'margin': NO_MARGIN,
								}
							})
							.component(),
						view.modelBuilder
							.text()
							.withProps({
								value: constants.SQL_MIGRATION_SERVICE_DETAILS_SUB_TITLE,
								CSSStyles: {
									'font-size': DESCRIPTION_FONT_SIZE,
									'margin': NO_MARGIN,
								}
							})
							.component(),
					])
					.withLayout({
						flexFlow: 'column',
						textAlign: 'left',
					})
					.component(),
			])
			.withLayout({ flexFlow: 'row', })
			.withProps({
				display: 'inline-flex',
				CSSStyles: { 'margin': LABEL_MARGIN },
			})
			.component();
	}

	private _createInfoTextItem(view: azdata.ModelView, value: string, title: string, margin: string): azdata.FlexContainer {
		return view.modelBuilder
			.flexContainer()
			.withItems([
				view.modelBuilder
					.text()
					.withProps({
						value: value,
						CSSStyles: {
							'font-size': FONT_SIZE,
							'margin': NO_MARGIN,
						}
					})
					.component(),
				view.modelBuilder
					.image()
					.withProps({
						iconPath: IconPathHelper.info,
						height: INFO_BALLOON_SIZE,
						width: INFO_BALLOON_SIZE,
						iconHeight: INFO_BALLOON_SIZE,
						iconWidth: INFO_BALLOON_SIZE,
						title: value,
						CSSStyles: { 'margin': INFO_BALLOON_MARGIN },
					})
					.component(),
			])
			.withLayout({ flexFlow: 'row' })
			.withProps({
				display: 'inline-flex',
				CSSStyles: { 'margin': margin },
			})
			.component();
	}

	private _createTextItem(view: azdata.ModelView, value: string, margin: string): azdata.TextComponent {
		return view.modelBuilder
			.text()
			.withProps({
				value: value,
				title: value,
				CSSStyles: {
					'font-size': FONT_SIZE,
					'margin': margin,
				}
			})
			.component();
	}

	private _createIrTable(view: azdata.ModelView): azdata.DeclarativeTableComponent {
		return view.modelBuilder
			.declarativeTable()
			.withProps({
				columns: [
					this._createColumn(constants.NAME, COLUMN_WIDTH, azdata.DeclarativeDataType.string),
					this._createColumn(constants.AUTH_KEY_COLUMN_HEADER, STRETCH_WIDTH, azdata.DeclarativeDataType.string),
					this._createColumn('', COLUMN_WIDTH, azdata.DeclarativeDataType.component),
				],
				CSSStyles: {
					'margin': VALUE_MARGIN,
					'text-align': 'left',
				},
			})
			.component();
	}

	private _createColumn(name: string, width: string, valueType: azdata.DeclarativeDataType): azdata.DeclarativeTableColumn {
		return {
			displayName: name,
			valueType: valueType,
			width: width,
			isReadOnly: true,
			rowCssStyles: { 'font-size': FONT_SIZE },
			headerCssStyles: {
				'font-size': FONT_SIZE,
				'font-weight': 'normal',
			},
		};
	}

	private async _refreshAuthTable(view: azdata.ModelView, migrationContext: MigrationContext): Promise<void> {
		const keys = await getSqlMigrationServiceAuthKeys(
			migrationContext.azureAccount,
			migrationContext.subscription,
			migrationContext.controller.properties.resourceGroup,
			migrationContext.controller.location.toUpperCase(),
			migrationContext.controller.name);

		const copyKey1Button = view.modelBuilder
			.button()
			.withProps({ iconPath: IconPathHelper.copy })
			.component();

		copyKey1Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(keys.authKey1);
			vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
		});

		const copyKey2Button = view.modelBuilder
			.button()
			.withProps({ iconPath: IconPathHelper.copy })
			.component();

		copyKey2Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(keys.authKey2);
			vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
		});

		const refreshKey1Button = view.modelBuilder
			.button()
			.withProps({
				iconPath: IconPathHelper.refresh,
				enabled: false,
			})
			.component();

		const refreshKey2Button = view.modelBuilder
			.button()
			.withProps({
				iconPath: IconPathHelper.refresh,
				enabled: false,
			})
			.component();

		this._migrationServiceAuthKeyTable.updateProperties({
			dataValues: [
				[
					{ value: constants.SERVICE_KEY1_LABEL },
					{ value: keys.authKey1 },
					{
						value: view.modelBuilder
							.flexContainer()
							.withItems([copyKey1Button, refreshKey1Button])
							.component()
					}
				],
				[
					{ value: constants.SERVICE_KEY2_LABEL },
					{ value: keys.authKey2 },
					{
						value: view.modelBuilder
							.flexContainer()
							.withItems([copyKey2Button, refreshKey2Button])
							.component()
					}
				]
			]
		});
	}
}
