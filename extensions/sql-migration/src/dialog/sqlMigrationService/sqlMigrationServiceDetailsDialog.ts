// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, regenerateSqlMigrationServiceAuthKey } from '../../api/azure';
import { IconPathHelper } from '../../constants/iconPathHelper';
import * as constants from '../../constants/strings';
import { MigrationContext } from '../../models/migrationLocalStorage';
import * as styles from '../../constants/styles';

const CONTROL_MARGIN = '10px';
const COLUMN_WIDTH = '50px';
const STRETCH_WIDTH = '100%';
const LABEL_MARGIN = '0 10px 0 10px';
const VALUE_MARGIN = '0 10px 10px 10px';
const INFO_VALUE_MARGIN = '0 10px 0 0';
const ICON_SIZE = '28px';
const IMAGE_SIZE = '21px';
const AUTH_KEY1 = 'authKey1';
const AUTH_KEY2 = 'authKey2';

export class SqlMigrationServiceDetailsDialog {

	private _dialog: azdata.window.Dialog;
	private _migrationServiceAuthKeyTable!: azdata.DeclarativeTableComponent;
	private _disposables: vscode.Disposable[] = [];

	constructor(private migrationContext: MigrationContext) {
		this._dialog = azdata.window.createModelViewDialog(
			'',
			'SqlMigrationServiceDetailsDialog',
			580,
			'flyout');
	}

	async initialize(): Promise<void> {
		this._dialog.registerContent(
			async (view: azdata.ModelView) => {
				this._disposables.push(view.onClosed(e => {
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));

				await this.createServiceContent(
					view,
					this.migrationContext);
			});

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
			migrationContext.controller.name,
			this.migrationContext.sessionId!
		));
		const serviceNodeName = serviceNode.nodes?.map(node => node.nodeName).join(', ')
			|| constants.SQL_MIGRATION_SERVICE_DETAILS_STATUS_UNAVAILABLE;

		const flexContainer = view.modelBuilder
			.flexContainer()
			.withItems([
				this._createHeading(view, migrationContext),
				view.modelBuilder
					.separator()
					.withProps({ width: STRETCH_WIDTH })
					.component(),
				this._createTextItem(view, constants.SUBSCRIPTION, LABEL_MARGIN),
				this._createTextItem(view, migrationContext.subscription.name, VALUE_MARGIN),
				this._createTextItem(view, constants.LOCATION, LABEL_MARGIN),
				this._createTextItem(view, migrationContext.controller.location.toUpperCase(), VALUE_MARGIN),
				this._createTextItem(view, constants.RESOURCE_GROUP, LABEL_MARGIN),
				this._createTextItem(view, migrationContext.controller.properties.resourceGroup, VALUE_MARGIN),
				this._createTextItem(view, constants.SQL_MIGRATION_SERVICE_DETAILS_IR_LABEL, LABEL_MARGIN),
				this._createTextItem(view, serviceNodeName, VALUE_MARGIN),
				this._createTextItem(
					view,
					constants.SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_LABEL,
					INFO_VALUE_MARGIN,
					constants.SQL_MIGRATION_SERVICE_DETAILS_AUTH_KEYS_TITLE),
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
									...styles.SECTION_HEADER_CSS
								}
							})
							.component(),
						view.modelBuilder
							.text()
							.withProps({
								value: constants.SQL_MIGRATION_SERVICE_DETAILS_SUB_TITLE,
								CSSStyles: {
									...styles.SMALL_NOTE_CSS
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
			.withLayout({ flexFlow: 'row' })
			.withProps({
				display: 'inline-flex',
				CSSStyles: { 'margin': LABEL_MARGIN },
			})
			.component();
	}

	private _createTextItem(view: azdata.ModelView, value: string, margin: string, description?: string): azdata.TextComponent {
		return view.modelBuilder
			.text()
			.withProps({
				value: value,
				description: description,
				title: value,
				CSSStyles: {
					...styles.BODY_CSS,
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
			rowCssStyles: {
				...styles.BODY_CSS
			},
			headerCssStyles: {
				...styles.BODY_CSS
			},
		};
	}

	private async _regenerateAuthKey(view: azdata.ModelView, migrationContext: MigrationContext, keyName: string): Promise<void> {
		const keys = await regenerateSqlMigrationServiceAuthKey(
			migrationContext.azureAccount,
			migrationContext.subscription,
			migrationContext.controller.properties.resourceGroup,
			migrationContext.controller.location.toUpperCase(),
			migrationContext.controller.name,
			keyName,
			migrationContext.sessionId!);

		if (keys?.authKey1 && keyName === AUTH_KEY1) {
			await this._updateTableCell(this._migrationServiceAuthKeyTable, 0, 1, keys.authKey1, constants.SERVICE_KEY1_LABEL);
		}
		else if (keys?.authKey2 && keyName === AUTH_KEY2) {
			await this._updateTableCell(this._migrationServiceAuthKeyTable, 1, 1, keys.authKey2, constants.SERVICE_KEY2_LABEL);
		}
	}

	private async _updateTableCell(table: azdata.DeclarativeTableComponent, row: number, col: number, value: string, keyName: string): Promise<void> {
		const dataValues = table.dataValues;
		dataValues![row][col].value = value;
		table.dataValues = [];
		table.dataValues = dataValues;
		await vscode.window.showInformationMessage(constants.AUTH_KEY_REFRESHED(keyName));
	}

	private async _refreshAuthTable(view: azdata.ModelView, migrationContext: MigrationContext): Promise<void> {
		const keys = await getSqlMigrationServiceAuthKeys(
			migrationContext.azureAccount,
			migrationContext.subscription,
			migrationContext.controller.properties.resourceGroup,
			migrationContext.controller.location.toUpperCase(),
			migrationContext.controller.name,
			migrationContext.sessionId!);

		const copyKey1Button = view.modelBuilder
			.button()
			.withProps({
				title: constants.COPY_KEY1,
				iconPath: IconPathHelper.copy,
				height: IMAGE_SIZE,
				width: IMAGE_SIZE,
				ariaLabel: constants.COPY_KEY1,
			})
			.component();

		this._disposables.push(copyKey1Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(keys.authKey1);
			vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
		}));

		const copyKey2Button = view.modelBuilder
			.button()
			.withProps({
				title: constants.COPY_KEY2,
				iconPath: IconPathHelper.copy,
				height: IMAGE_SIZE,
				width: IMAGE_SIZE,
				ariaLabel: constants.COPY_KEY2,
			})
			.component();

		this._disposables.push(copyKey2Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(keys.authKey2);
			vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
		}));

		const refreshKey1Button = view.modelBuilder
			.button()
			.withProps({
				title: constants.REFRESH_KEY1,
				iconPath: IconPathHelper.refresh,
				height: IMAGE_SIZE,
				width: IMAGE_SIZE,
				ariaLabel: constants.REFRESH_KEY1,
			})
			.component();
		this._disposables.push(refreshKey1Button.onDidClick(
			async (e) => await this._regenerateAuthKey(view, migrationContext, AUTH_KEY1)));

		const refreshKey2Button = view.modelBuilder
			.button()
			.withProps({
				title: constants.REFRESH_KEY2,
				iconPath: IconPathHelper.refresh,
				height: IMAGE_SIZE,
				width: IMAGE_SIZE,
				ariaLabel: constants.REFRESH_KEY2,
			})
			.component();
		this._disposables.push(refreshKey2Button.onDidClick(
			async (e) => await this._regenerateAuthKey(view, migrationContext, AUTH_KEY2)));

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
