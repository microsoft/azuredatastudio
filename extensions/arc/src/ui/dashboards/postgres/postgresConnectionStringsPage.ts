/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresDashboardPage } from './postgresDashboardPage';

export class PostgresConnectionStringsPage extends PostgresDashboardPage {
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
		return this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Connection strings' }).component();
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return undefined;
	}
}
