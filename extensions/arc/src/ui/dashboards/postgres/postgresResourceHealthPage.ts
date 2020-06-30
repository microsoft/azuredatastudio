/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';
import { fromNow } from '../../../common/date';

export class PostgresResourceHealthPage extends DashboardPage {
	private interval: NodeJS.Timeout;
	private podsUpdated?: azdata.TextComponent;
	private podsLoading?: azdata.LoadingComponent;
	private conditionsLoading?: azdata.LoadingComponent;
	private podsTable?: azdata.DeclarativeTableComponent;
	private conditionsTable?: azdata.DeclarativeTableComponent;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);

		this.disposables.push(
			modelView.onClosed(() => {
				try { clearInterval(this.interval); }
				catch { }
			}));

		this.disposables.push(this._postgresModel.onServiceUpdated(
			() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())));

		// Keep the last updated timestamps up to date with the current time
		this.interval = setInterval(() => this.handleServiceUpdated(), 60 * 1000);
	}

	protected get title(): string {
		return loc.resourceHealth;
	}

	protected get id(): string {
		return 'postgres-resource-health';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.health;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.resourceHealth,
			CSSStyles: { ...cssStyles.title, 'margin-bottom': '30px' }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.podOverview,
			CSSStyles: { ...cssStyles.title, 'margin-block-end': '0' }
		}).component());

		this.podsUpdated = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: this.getPodsLastUpdated(),
			CSSStyles: { ...cssStyles.text, 'font-size': '12px', 'margin-block-start': '0' }
		}).component();

		content.addItem(this.podsUpdated);

		// Pod overview
		this.podsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			columns: [
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.string,
					width: '35%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: { ...cssStyles.tableRow, 'font-size': '20px', 'font-weight': 'bold', 'padding': '7px' }
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.string,
					width: '65%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: { ...cssStyles.tableRow, 'padding': '7px' }
				}
			],
			data: this.getPodsTable()
		}).component();

		this.podsLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.podsTable)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.serviceLastUpdated
			}).component();

		content.addItem(this.podsLoading, { CSSStyles: { 'margin-bottom': '30px' } });

		// Conditions table
		this.conditionsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.condition,
					valueType: azdata.DeclarativeDataType.string,
					width: '15%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '1%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.details,
					valueType: azdata.DeclarativeDataType.string,
					width: '64%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.lastUpdated,
					valueType: azdata.DeclarativeDataType.string,
					width: '20%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: { ...cssStyles.tableRow, 'white-space': 'nowrap' }
				}
			],
			data: this.getConditionsTable()
		}).component();

		this.conditionsLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.conditionsTable)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.serviceLastUpdated
			}).component();

		content.addItem(this.conditionsLoading);
		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		const refreshButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();

		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					this.podsLoading!.loading = true;
					this.conditionsLoading!.loading = true;
					await this._postgresModel.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				} finally {
					refreshButton.enabled = true;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: refreshButton }
		]).component();
	}

	private getPodsLastUpdated(): string {
		return this._postgresModel.serviceLastUpdated
			? loc.updated(fromNow(this._postgresModel.serviceLastUpdated!, true)) : '';
	}

	private getPodsTable(): (string | number)[][] {
		return [
			[this._postgresModel.service?.status?.podsRunning ?? 0, loc.running],
			[this._postgresModel.service?.status?.podsPending ?? 0, loc.pending],
			[this._postgresModel.service?.status?.podsFailed ?? 0, loc.failed],
			[this._postgresModel.service?.status?.podsUnknown ?? 0, loc.unknown]
		];
	}

	private getConditionsTable(): (string | azdata.ImageComponent)[][] {
		return this._postgresModel.service?.status?.conditions?.map(c => {
			const healthy = c.type === 'Ready' ? c.status === 'True' : c.status === 'False';

			const image = this.modelView.modelBuilder.image().withProperties<azdata.ImageComponentProperties>({
				iconPath: healthy ? IconPathHelper.success : IconPathHelper.fail,
				iconHeight: '20px',
				iconWidth: '20px',
				width: '20px',
				height: '20px'
			}).component();

			return [
				c.type ?? '',
				image,
				c.message ?? '',
				c.lastTransitionTime ? fromNow(c.lastTransitionTime!, true) : ''
			];
		}) ?? [];
	}

	private handleServiceUpdated() {
		this.podsUpdated!.value = this.getPodsLastUpdated();
		this.podsTable!.data = this.getPodsTable();
		this.podsLoading!.loading = false;

		this.conditionsTable!.data = this.getConditionsTable();
		this.conditionsLoading!.loading = false;
	}
}
