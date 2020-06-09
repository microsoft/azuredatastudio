/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { KeyValueContainer, KeyValue, InputKeyValue } from '../../components/keyValueContainer';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel, Registration } from '../../../models/controllerModel';
import { ResourceType } from '../../../common/utils';
import { MiaaModel } from '../../../models/miaaModel';

export class MiaaConnectionStringsPage extends DashboardPage {

	private _keyValueContainer!: KeyValueContainer;
	private _instanceRegistration: Registration | undefined;

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super(modelView);
		this._controllerModel.onRegistrationsUpdated(registrations => {
			this._instanceRegistration = registrations.find(reg => reg.instanceType === ResourceType.sqlManagedInstances && reg.instanceName === this._miaaModel.name);
			this.eventuallyRunOnInitialized(() => this.updateConnectionStrings());
		});
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
			value: `${loc.selectConnectionString}`,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		content.addItem(
			this.modelView.modelBuilder.flexContainer().withItems([info]).withLayout({ flexWrap: 'wrap' }).component(),
			{ CSSStyles: { display: 'inline-flex', 'margin-bottom': '25px' } });

		this._keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, []);
		content.addItem(this._keyValueContainer.container);
		this.updateConnectionStrings();
		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}

	private updateConnectionStrings(): void {
		if (!this._instanceRegistration) {
			return;
		}

		const ip = this._instanceRegistration.externalIp;
		const port = this._instanceRegistration.externalPort;
		const username = this._miaaModel.connectionProfile.userName;
		const password = this._miaaModel.connectionProfile.password;

		const pairs: KeyValue[] = [
			new InputKeyValue('ADO.NET', `Server=${ip};Database=master;Port=${port};User Id=${username};Password=${password};Ssl Mode=Require;`),
			new InputKeyValue('C++ (libpq)', `host=${ip} port=${port} dbname=master user=${username} password=${password} sslmode=require`),
			new InputKeyValue('JDBC', `jdbc:sqlserver://${ip}:${port}/master?user=${username}&password=${password}&sslmode=require`),
			new InputKeyValue('Node.js', `host=${ip} port=${port} dbname=master user=${username} password=${password} sslmode=require`),
			new InputKeyValue('PHP', `host=${ip} port=${port} dbname=master user=${username} password=${password} sslmode=require`),
			new InputKeyValue('psql', `psql "host=${ip} port=${port} dbname=master user=${username} password=${password} sslmode=require`),
			new InputKeyValue('Python', `dbname='master' user='${username}' host='${ip}' password='${password}' port='${port}' sslmode='true'`),
			new InputKeyValue('Ruby', `host=${ip}; dbname=master user=${username} password=${password} port=${port} sslmode=require`),
			new InputKeyValue('Web App', `Database=master; Data Source=${ip}; User Id=${username}; Password=${password}`)
		];
		this._keyValueContainer.refresh(pairs);
	}
}
