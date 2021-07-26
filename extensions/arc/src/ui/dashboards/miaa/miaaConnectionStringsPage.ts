/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { KeyValueContainer, KeyValue, InputKeyValue, MultilineInputKeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { MiaaModel } from '../../../models/miaaModel';
import { parseIpAndPort } from '../../../common/utils';

export class MiaaConnectionStringsPage extends DashboardPage {

	private _keyValueContainer!: KeyValueContainer;
	private _connectionStringsMessage!: azdata.TextComponent;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _miaaModel: MiaaModel) {
		super(modelView, dashboard);
		this.disposables.push(this._miaaModel.onConfigUpdated(_ =>
			this.eventuallyRunOnInitialized(() => this.updateConnectionStrings())));
		this.disposables.push(this._miaaModel.onDatabasesUpdated(_ =>
			this.eventuallyRunOnInitialized(() => this.updateConnectionStrings())));
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

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.connectionStrings,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProps({
			value: `${loc.selectConnectionString}`,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		content.addItem(
			this.modelView.modelBuilder.flexContainer().withItems([info]).withLayout({ flexWrap: 'wrap' }).component(),
			{ CSSStyles: { display: 'inline-flex', 'margin-bottom': '25px' } });

		this._keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, this.getConnectionStrings());
		this.disposables.push(this._keyValueContainer);
		content.addItem(this._keyValueContainer.container);

		this._connectionStringsMessage = this.modelView.modelBuilder.text()
			.withProps({ CSSStyles: { 'text-align': 'center' } })
			.component();
		content.addItem(this._connectionStringsMessage);

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}

	private getConnectionStrings(): KeyValue[] {
		const config = this._miaaModel.config;
		if (!config?.status.primaryEndpoint) {
			return [];
		}

		const externalEndpoint = parseIpAndPort(config.status.primaryEndpoint);
		const username = this._miaaModel.username ?? '{your_username_here}';

		return [
			new InputKeyValue(this.modelView.modelBuilder, 'ADO.NET', `Server=tcp:${externalEndpoint.ip},${externalEndpoint.port};Persist Security Info=False;User ID=${username};Password={your_password_here};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`),
			new InputKeyValue(this.modelView.modelBuilder, 'C++ (libpq)', `host=${externalEndpoint.ip} port=${externalEndpoint.port} user=${username} password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'JDBC', `jdbc:sqlserver://${externalEndpoint.ip}:${externalEndpoint.port};user=${username};password={your_password_here};encrypt=true;trustServerCertificate=false;loginTimeout=30;`),
			new InputKeyValue(this.modelView.modelBuilder, 'Node.js', `host=${externalEndpoint.ip} port=${externalEndpoint.port} dbname=master user=${username} password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'ODBC', `Driver={ODBC Driver 13 for SQL Server};Server=${externalEndpoint.ip},${externalEndpoint.port};Uid=${username};Pwd={your_password_here};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;`),
			new MultilineInputKeyValue(this.modelView.modelBuilder, 'PHP',
				`$connectionInfo = array("UID" => "${username}", "pwd" => "{your_password_here}", "LoginTimeout" => 30, "Encrypt" => 1, "TrustServerCertificate" => 0);
$serverName = "${externalEndpoint.ip},${externalEndpoint.port}";
$conn = sqlsrv_connect($serverName, $connectionInfo);`),
			new InputKeyValue(this.modelView.modelBuilder, 'Python', `dbname='master' user='${username}' host='${externalEndpoint.ip}' password='{your_password_here}' port='${externalEndpoint.port}' sslmode='true'`),
			new InputKeyValue(this.modelView.modelBuilder, 'Ruby', `host=${externalEndpoint.ip}; user=${username} password={your_password_here} port=${externalEndpoint.port} sslmode=require`)
		];
	}

	private updateConnectionStrings(): void {
		this._connectionStringsMessage.value = !this._miaaModel.config?.status.primaryEndpoint ? loc.noExternalEndpoint : '';
		this._keyValueContainer.refresh(this.getConnectionStrings());
	}
}
