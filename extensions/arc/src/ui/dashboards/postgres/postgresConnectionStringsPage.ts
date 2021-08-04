/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { KeyValueContainer, InputKeyValue, KeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresConnectionStringsPage extends DashboardPage {
	private keyValueContainer?: KeyValueContainer;
	private connectionStringsLoading!: azdata.LoadingComponent;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);

		this.disposables.push(this._postgresModel.onConfigUpdated(
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

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.connectionStrings,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProps({
			value: loc.selectConnectionString,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.learnAboutPostgresClients,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/get-connection-endpoints-and-connection-strings-postgres-hyperscale',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '25px' } });

		this.keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, this.getConnectionStrings());
		this.disposables.push(this.keyValueContainer);

		this.connectionStringsLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.keyValueContainer.container)
			.withProps({
				loading: !this._postgresModel.configLastUpdated
			}).component();

		content.addItem(this.connectionStringsLoading, { CSSStyles: cssStyles.text });
		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}

	private getConnectionStrings(): KeyValue[] {
		const endpoint = this._postgresModel.endpoint;
		if (!endpoint) {
			return [];
		}

		return [
			new InputKeyValue(this.modelView.modelBuilder, 'ADO.NET', `Server=${endpoint.ip};Database=postgres;Port=${endpoint.port};User Id=postgres;Password={your_password_here};Ssl Mode=Require;`),
			new InputKeyValue(this.modelView.modelBuilder, 'C++ (libpq)', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'JDBC', `jdbc:postgresql://${endpoint.ip}:${endpoint.port}/postgres?user=postgres&password={your_password_here}&sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'Node.js', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'PHP', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'psql', `psql "host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password={your_password_here} sslmode=require"`),
			new InputKeyValue(this.modelView.modelBuilder, 'Python', `dbname='postgres' user='postgres' host='${endpoint.ip}' password='{your_password_here}' port='${endpoint.port}' sslmode='true'`),
			new InputKeyValue(this.modelView.modelBuilder, 'Ruby', `host=${endpoint.ip}; dbname=postgres user=postgres password={your_password_here} port=${endpoint.port} sslmode=require`)
		];
	}

	private handleServiceUpdated() {
		this.keyValueContainer?.refresh(this.getConnectionStrings());
		this.connectionStringsLoading.loading = false;
	}
}
