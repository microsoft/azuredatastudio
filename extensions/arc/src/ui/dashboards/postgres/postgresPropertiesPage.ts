/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { PostgresDashboardPage } from './postgresDashboardPage';
import { KeyValueContainer, KeyValue, InputKeyValue, LinkKeyValue, TextKeyValue } from '../../components/keyValueContainer';


export class PostgresPropertiesPage extends PostgresDashboardPage {
	protected get title(): string {
		return loc.properties;
	}

	protected get id(): string {
		return 'postgres-properties';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.properties;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.properties,
			CSSStyles: { ...cssStyles.title, 'margin-bottom': '25px' }
		}).component());

		const endpoint: { ip?: string, port?: number } = this.databaseModel.endpoint();
		const connectionString = `postgresql://postgres:${this.databaseModel.password()}@${endpoint.ip}:${endpoint.port}`;
		const registration = this.controllerModel.registration('postgresInstances', this.databaseModel.namespace(), this.databaseModel.name());

		const pairs: KeyValue[] = [
			new InputKeyValue(loc.coordinatorEndpoint, connectionString),
			new InputKeyValue(loc.postgresAdminUsername, 'postgres'),
			new TextKeyValue(loc.status, this.databaseModel.service().status?.state ?? 'Unknown'),
			new LinkKeyValue(loc.dataController, this.controllerModel.namespace(), _ => vscode.window.showInformationMessage('goto data controller')),
			new LinkKeyValue(loc.nodeConfiguration, this.databaseModel.configuration(), _ => vscode.window.showInformationMessage('goto configuration')),
			new TextKeyValue(loc.postgresVersion, this.databaseModel.service().spec.engine.version?.toString() ?? ''),
			new TextKeyValue(loc.resourceGroup, registration?.resourceGroupName ?? ''),
			new TextKeyValue(loc.subscriptionId, registration?.subscriptionId ?? '')
		];

		const keyValueContainer = new KeyValueContainer(this.modelView.modelBuilder, pairs);
		content.addItem(keyValueContainer.container);
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
