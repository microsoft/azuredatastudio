/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';
import { AdsMigrationStatus, TabBase } from './tabBase';
import { MigrationsListTab, MigrationsListTabId } from './migrationsListTab';
import { DatabaseMigration } from '../api/azure';
import { MigrationLocalStorage } from '../models/migrationLocalStorage';
import { FileStorageType } from '../models/stateMachine';
import { MigrationDetailsTabBase } from './migrationDetailsTabBase';
import { MigrationDetailsFileShareTab } from './migrationDetailsFileShareTab';
import { MigrationDetailsBlobContainerTab } from './migrationDetailsBlobContainerTab';
import { MigrationDetailsTableTab } from './migrationDetailsTableTab';
import { DashboardStatusBar } from './sqlServerDashboard';

export const MigrationsTabId = 'MigrationsTab';

export class MigrationsTab extends TabBase<MigrationsTab> {
	private _tab!: azdata.DivContainer;
	private _migrationsListTab!: MigrationsListTab;
	private _migrationDetailsTab!: MigrationDetailsTabBase<any>;
	private _migrationDetailsFileShareTab!: MigrationDetailsTabBase<any>;
	private _migrationDetailsBlobTab!: MigrationDetailsTabBase<any>;
	private _migrationDetailsTableTab!: MigrationDetailsTabBase<any>;
	private _selectedTabId: string | undefined = undefined;

	constructor() {
		super();
		this.title = loc.DESKTOP_MIGRATIONS_TAB_TITLE;
		this.id = MigrationsTabId;
	}

	public onDialogClosed = async (): Promise<void> =>
		await this._migrationsListTab.onDialogClosed();

	public async create(
		context: vscode.ExtensionContext,
		view: azdata.ModelView,
		statusBar: DashboardStatusBar): Promise<MigrationsTab> {

		this.context = context;
		this.view = view;
		this.statusBar = statusBar;

		await this.initialize(view);
		await this._openTab(this._migrationsListTab);

		return this;
	}

	public async refresh(): Promise<void> {
		switch (this._selectedTabId) {
			case undefined:
			case MigrationsListTabId:
				return await this._migrationsListTab?.refresh();
			default:
				return await this._migrationDetailsTab?.refresh();
		}
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		this._tab = this.view.modelBuilder.divContainer()
			.withLayout({ height: '100%' })
			.withProps({
				CSSStyles: {
					'margin': '0px',
					'padding': '0px',
					'width': '100%'
				}
			})
			.component();

		this._migrationsListTab = await new MigrationsListTab().create(
			this.context,
			this.view,
			async (migration) => await this._openMigrationDetails(migration),
			this.statusBar);
		this.disposables.push(this._migrationsListTab);

		this._migrationDetailsBlobTab = await new MigrationDetailsBlobContainerTab().create(
			this.context,
			this.view,
			async () => await this._openMigrationsListTab(),
			this.statusBar);
		this.disposables.push(this._migrationDetailsBlobTab);

		this._migrationDetailsFileShareTab = await new MigrationDetailsFileShareTab().create(
			this.context,
			this.view,
			async () => await this._openMigrationsListTab(),
			this.statusBar);
		this.disposables.push(this._migrationDetailsFileShareTab);

		this._migrationDetailsTableTab = await new MigrationDetailsTableTab().create(
			this.context,
			this.view,
			async () => await this._openMigrationsListTab(),
			this.statusBar);
		this.disposables.push(this._migrationDetailsFileShareTab);

		this.content = this._tab;
	}

	public async setMigrationFilter(filter: AdsMigrationStatus): Promise<void> {
		await this._migrationsListTab?.setMigrationFilter(filter);
		await this._openTab(this._migrationsListTab);
		await this._migrationsListTab?.setMigrationFilter(filter);
	}

	private async _openMigrationDetails(migration: DatabaseMigration): Promise<void> {
		switch (migration.properties.backupConfiguration?.sourceLocation?.fileStorageType) {
			case FileStorageType.AzureBlob:
				this._migrationDetailsTab = this._migrationDetailsBlobTab;
				break;
			case FileStorageType.FileShare:
				this._migrationDetailsTab = this._migrationDetailsFileShareTab;
				break;
			case FileStorageType.None:
				this._migrationDetailsTab = this._migrationDetailsTableTab;
				break;
		}

		await this._migrationDetailsTab.setMigrationContext(
			await MigrationLocalStorage.getMigrationServiceContext(),
			migration);

		await this._openTab(this._migrationDetailsTab);
	}

	private async _openMigrationsListTab(): Promise<void> {
		await this.statusBar.clearError();
		await this._openTab(this._migrationsListTab);
	}

	private async _openTab(tab: azdata.Tab): Promise<void> {
		if (tab.id === this._selectedTabId) {
			return;
		}

		this._tab.clearItems();
		this._tab.addItem(tab.content);
		this._selectedTabId = tab.id;
	}
}
