/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresDashboardPage } from './postgresDashboardPage';

export class PostgresNetworkingPage extends PostgresDashboardPage {
	protected get title(): string {
		return loc.networking;
	}

	protected get id(): string {
		return 'postgres-networking';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.networking;
	}

	protected get container(): azdata.Component {
		return this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Networking' }).component();
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
