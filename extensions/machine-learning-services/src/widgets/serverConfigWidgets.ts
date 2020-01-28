/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import { ServerConfigManager } from '../serverConfig/serverConfigManager';
import { ConfigTable } from './configTable';

export class ServerConfigWidget {

	constructor(private _apiWrapper: ApiWrapper, private _serverConfigManager: ServerConfigManager) {
	}

	/**
	 * Registers the widget and initializes the components
	 */
	public register(): void {
		azdata.ui.registerModelViewProvider('ml.tasks', async (view) => {
			const container = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();
			const mainContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '270px',
				height: '100%',
				position: 'absolute'
			}).component();
			mainContainer.addItem(container, {
				CSSStyles: {
					'padding-top': '25px',
					'padding-left': '5px'
				}
			});
			let spinner = view.modelBuilder.loadingComponent()
				.withItem(mainContainer)
				.withProperties<azdata.LoadingComponentProperties>({ loading: true })
				.component();

			const configTable = new ConfigTable(this._apiWrapper, this._serverConfigManager, view.modelBuilder, spinner);

			this.addRow(container, view, configTable.component);

			await view.initializeModel(spinner);
			await configTable.refresh();
		});
	}

	private addRow(container: azdata.FlexContainer, view: azdata.ModelView, component: azdata.Component) {
		const bookRow = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			justifyContent: 'space-between',
			height: '100'
		}).component();
		bookRow.addItem(component, {
			CSSStyles: {
				'width': '100',
				'hight': '100',
				'padding-top': '10px',
				'text-align': 'left'
			}
		});
		container.addItems([bookRow]);
	}
}

