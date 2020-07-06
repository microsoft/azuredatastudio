/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { KeyValueContainer, InputKeyValue, KeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresConnectionStringsPage extends DashboardPage {
	private loading?: azdata.LoadingComponent;
	private keyValueContainer?: KeyValueContainer;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);

		this.disposables.push(this._postgresModel.onServiceUpdated(
			() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())));
	}

	protected get title(): string {
		return loc.connectionStrings;
	}

	protected get id(): string {
		return 'postgres-connection-strings';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.connection;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.connectionStrings,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.selectConnectionString,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.learnAboutPostgresClients,
			url: 'https://docs.microsoft.com/azure/postgresql/concepts-connection-libraries',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '25px' } });

		this.keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, this.getConnectionStrings());
		this.disposables.push(this.keyValueContainer);

		this.loading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.keyValueContainer.container)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.serviceLastUpdated
			}).component();

		content.addItem(this.loading);
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
					this.loading!.loading = true;
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

	private getConnectionStrings(): KeyValue[] {
		const endpoint: { ip?: string, port?: number } = this._postgresModel.endpoint;

		return [
			new InputKeyValue(this.modelView.modelBuilder, 'ADO.NET', `Server=${endpoint.ip};Database=postgres;Port=${endpoint.port};User Id=postgres;Password={your_password_here};Ssl Mode=Require;`),
			new InputKeyValue(this.modelView.modelBuilder, 'C++ (libpq)', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'JDBC', `jdbc:postgresql://${endpoint.ip}:${endpoint.port}/postgres?user=postgres&password={your_password_here}&sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'Node.js', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'PHP', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'psql', `psql "host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require"`),
			new InputKeyValue(this.modelView.modelBuilder, 'Python', `dbname='postgres' user='postgres' host='${endpoint.ip}' password='{your_password_here}' port='${endpoint.port}' sslmode='true'`),
			new InputKeyValue(this.modelView.modelBuilder, 'Ruby', `host=${endpoint.ip}; dbname=postgres user=postgres password={your_password_here} port=${endpoint.port} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'Web App', `Database=postgres; Data Source=${endpoint.ip}; User Id=postgres; Password={your_password_here}`)
		];
	}

	private handleServiceUpdated() {
		this.keyValueContainer?.refresh(this.getConnectionStrings());
		this.loading!.loading = false;
	}
}
