/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';

export class PostgresBackupPage extends DashboardPage {
	protected get title(): string {
		return loc.backup;
	}

	protected get id(): string {
		return 'postgres-backup';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.backup;
	}

	protected get container(): azdata.Component {
		return this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.backup }).component();
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		return this.modelView.modelBuilder.toolbarContainer().component();
	}
}
