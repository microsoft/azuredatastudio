/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { InitializingComponent } from './initializingComponent';

export abstract class DashboardPage extends InitializingComponent {

	constructor(protected modelView: azdata.ModelView) {
		super();
	}

	public get tab(): azdata.DashboardTab {
		return {
			title: this.title,
			id: this.id,
			icon: this.icon,
			content: this.container,
			toolbar: this.toolbarContainer
		};
	}

	protected abstract get title(): string;
	protected abstract get id(): string;
	protected abstract get icon(): { dark: string; light: string; };
	protected abstract get container(): azdata.Component;
	protected abstract get toolbarContainer(): azdata.ToolbarContainer;

}

