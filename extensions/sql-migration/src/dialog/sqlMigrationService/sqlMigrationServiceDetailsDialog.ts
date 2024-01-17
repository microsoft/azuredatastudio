/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DatabaseMigration, getSqlMigrationServiceMonitoringData } from '../../api/azure';
import { IconPathHelper } from '../../constants/iconPathHelper';
import * as constants from '../../constants/strings';
import { MigrationServiceContext } from '../../models/migrationLocalStorage';
import * as styles from '../../constants/styles';
import { createAuthenticationKeyTable, createRegistrationInstructions, refreshAuthenticationKeyTable } from '../../api/utils';

const CONTROL_MARGIN = '10px';
const STRETCH_WIDTH = '100%';
const LABEL_MARGIN = '0 10px 0 10px';
const VALUE_MARGIN = '0 10px 10px 10px';
const ICON_SIZE = '28px';

export class SqlMigrationServiceDetailsDialog {

	private _dialog: azdata.window.Dialog;
	private _migrationServiceAuthKeyTable!: azdata.DeclarativeTableComponent;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		private _serviceContext: MigrationServiceContext,
		private _migration: DatabaseMigration) {

		this._dialog = azdata.window.createModelViewDialog(
			'',
			'SqlMigrationServiceDetailsDialog',
			750,
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
					this._serviceContext,
					this._migration);
			});

		this._dialog.okButton.label = constants.SQL_MIGRATION_SERVICE_DETAILS_BUTTON_LABEL;
		this._dialog.okButton.focused = true;
		this._dialog.okButton.position = 'left';

		this._dialog.cancelButton.hidden = true;
		azdata.window.openDialog(this._dialog);
	}

	private async createServiceContent(view: azdata.ModelView, serviceContext: MigrationServiceContext, migration: DatabaseMigration): Promise<void> {
		const instructions = createRegistrationInstructions(view, false);
		await instructions.updateCssStyles({
			...styles.BODY_CSS,
			'margin': LABEL_MARGIN,
		})

		this._migrationServiceAuthKeyTable = createAuthenticationKeyTable(view, '50px', '100%');
		const serviceNode = (await getSqlMigrationServiceMonitoringData(
			serviceContext.azureAccount!,
			serviceContext.subscription!,
			serviceContext.migrationService?.properties.resourceGroup!,
			serviceContext.migrationService?.location!,
			serviceContext.migrationService?.name!));
		const serviceNodeName = serviceNode.nodes?.map(node => node.nodeName).join(', ')
			|| constants.SQL_MIGRATION_SERVICE_DETAILS_STATUS_UNAVAILABLE;

		const flexContainer = view.modelBuilder
			.flexContainer()
			.withItems([
				this._createHeading(view, this._migration),
				view.modelBuilder
					.separator()
					.withProps({ width: STRETCH_WIDTH })
					.component(),
				this._createTextItem(view, constants.SUBSCRIPTION, LABEL_MARGIN),
				this._createTextItem(view, serviceContext.subscription?.name!, VALUE_MARGIN),
				this._createTextItem(view, constants.LOCATION, LABEL_MARGIN),
				this._createTextItem(view, serviceContext.migrationService?.location?.toUpperCase()!, VALUE_MARGIN),
				this._createTextItem(view, constants.RESOURCE_GROUP, LABEL_MARGIN),
				this._createTextItem(view, serviceContext.migrationService?.properties.resourceGroup!, VALUE_MARGIN),
				this._createTextItem(view, constants.SQL_MIGRATION_SERVICE_DETAILS_IR_LABEL, LABEL_MARGIN),
				this._createTextItem(view, serviceNodeName, VALUE_MARGIN),
				instructions,
				this._migrationServiceAuthKeyTable,
			])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'padding': CONTROL_MARGIN } })
			.component();

		await view.initializeModel(flexContainer);

		await refreshAuthenticationKeyTable(
			view,
			this._migrationServiceAuthKeyTable,
			serviceContext.azureAccount!,
			serviceContext.subscription!,
			serviceContext.migrationService?.properties.resourceGroup!,
			serviceContext.migrationService?.location.toUpperCase()!,
			serviceContext.migrationService!
		);
	}

	private _createHeading(view: azdata.ModelView, migration: DatabaseMigration): azdata.FlexContainer {
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
								value: this._serviceContext.migrationService?.name,
								CSSStyles: { ...styles.SECTION_HEADER_CSS }
							})
							.component(),
						view.modelBuilder
							.text()
							.withProps({
								value: constants.SQL_MIGRATION_SERVICE_DETAILS_SUB_TITLE,
								CSSStyles: { ...styles.SMALL_NOTE_CSS }
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
}
