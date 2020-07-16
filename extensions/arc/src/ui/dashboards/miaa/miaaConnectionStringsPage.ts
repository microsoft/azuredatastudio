/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, ResourceType } from '../../../constants';
import { KeyValueContainer, KeyValue, InputKeyValue, MultilineInputKeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { MiaaModel } from '../../../models/miaaModel';

export class MiaaConnectionStringsPage extends DashboardPage {

	private _keyValueContainer!: KeyValueContainer;

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super(modelView);
		this.disposables.push(this._controllerModel.onRegistrationsUpdated(_ =>
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

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.connectionStrings,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: `${loc.selectConnectionString}`,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		content.addItem(
			this.modelView.modelBuilder.flexContainer().withItems([info]).withLayout({ flexWrap: 'wrap' }).component(),
			{ CSSStyles: { display: 'inline-flex', 'margin-bottom': '25px' } });

		this._keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, this.getConnectionStrings());
		this.disposables.push(this._keyValueContainer);
		content.addItem(this._keyValueContainer.container);
		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}

	private getConnectionStrings(): KeyValue[] {
		const instanceRegistration = this._controllerModel.getRegistration(ResourceType.sqlManagedInstances, this._miaaModel.info.namespace, this._miaaModel.info.name);
		if (!instanceRegistration) {
			return [];
		}

		const ip = instanceRegistration.externalIp;
		const port = instanceRegistration.externalPort;
		const username = this._miaaModel.username;

		return [
			new InputKeyValue(this.modelView.modelBuilder, 'ADO.NET', `Server=tcp:${ip},${port};Persist Security Info=False;User ID=${username};Password={your_password_here};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`),
			new InputKeyValue(this.modelView.modelBuilder, 'C++ (libpq)', `host=${ip} port=${port} user=${username} password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'JDBC', `jdbc:sqlserver://${ip}:${port};user=${username};password={your_password_here};encrypt=true;trustServerCertificate=false;loginTimeout=30;`),
			new InputKeyValue(this.modelView.modelBuilder, 'Node.js', `host=${ip} port=${port} dbname=master user=${username} password={your_password_here} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'ODBC', `Driver={ODBC Driver 13 for SQL Server};Server=${ip},${port};Uid=${username};Pwd={your_password_here};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;`),
			new MultilineInputKeyValue(this.modelView.modelBuilder, 'PHP',
				`$connectionInfo = array("UID" => "${username}", "pwd" => "{your_password_here}", "LoginTimeout" => 30, "Encrypt" => 1, "TrustServerCertificate" => 0);
$serverName = "${ip},${port}";
$conn = sqlsrv_connect($serverName, $connectionInfo);`),
			new InputKeyValue(this.modelView.modelBuilder, 'Python', `dbname='master' user='${username}' host='${ip}' password='{your_password_here}' port='${port}' sslmode='true'`),
			new InputKeyValue(this.modelView.modelBuilder, 'Ruby', `host=${ip}; user=${username} password={your_password_here} port=${port} sslmode=require`),
			new InputKeyValue(this.modelView.modelBuilder, 'Web App', `Database=master; Data Source=${ip}; User Id=${username}; Password={your_password_here}`)
		];
	}

	private updateConnectionStrings(): void {
		this._keyValueContainer.refresh(this.getConnectionStrings());
	}
}
