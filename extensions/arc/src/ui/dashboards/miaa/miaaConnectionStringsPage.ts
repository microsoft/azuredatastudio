/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { KeyValueContainer, KeyValue, InputKeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';

export class MiaaConnectionStringsPage extends DashboardPage {

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel) {
		super(modelView);
		this.refresh().catch(err => console.error(err));
	}

	protected async refresh(): Promise<void> {
		await this._controllerModel.refresh();
	}

	protected get title(): string {
		return loc.connectionStrings;
	}

	protected get id(): string {
		return 'miaa-connection-strings';
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
			value: `${loc.selectConnectionString}.&nbsp;`,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.learnAboutPostgresClients,
			url: 'http://example.com', // TODO link to documentation
		}).component();

		content.addItem(
			this.modelView.modelBuilder.flexContainer().withItems([info, link]).withLayout({ flexWrap: 'wrap' }).component(),
			{ CSSStyles: { display: 'inline-flex', 'margin-bottom': '25px' } });

		const endpoint = { ip: '127.0.0.1', port: '1337' }; //{ ip?: string, port?: number } = this.databaseModel.endpoint();
		const password = 'mypassword'; //this.databaseModel.password();

		const pairs: KeyValue[] = [
			new InputKeyValue('ADO.NET', `Server=${endpoint.ip};Database=postgres;Port=${endpoint.port};User Id=postgres;Password=${password};Ssl Mode=Require;`),
			new InputKeyValue('C++ (libpq)', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password=${password} sslmode=require`),
			new InputKeyValue('JDBC', `jdbc:postgresql://${endpoint.ip}:${endpoint.port}/postgres?user=postgres&password=${password}&sslmode=require`),
			new InputKeyValue('Node.js', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password=${password} sslmode=require`),
			new InputKeyValue('PHP', `host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password=${password} sslmode=require`),
			new InputKeyValue('psql', `psql "host=${endpoint.ip} port=${endpoint.port} dbname=postgres user=postgres password=${password} sslmode=require`),
			new InputKeyValue('Python', `dbname='postgres' user='postgres' host='${endpoint.ip}' password='${password}' port='${endpoint.port}' sslmode='true'`),
			new InputKeyValue('Ruby', `host=${endpoint.ip}; dbname=postgres user=postgres password=${password} port=${endpoint.port} sslmode=require`),
			new InputKeyValue('Web App', `Database=postgres; Data Source=${endpoint.ip}; User Id=postgres; Password=${password}`)
		];

		const keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, pairs);
		content.addItem(keyValueContainer.container);
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
