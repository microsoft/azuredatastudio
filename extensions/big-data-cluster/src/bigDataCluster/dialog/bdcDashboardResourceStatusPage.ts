/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcStatusModel } from '../controller/apiGenerated';

const localize = nls.loadMessageBundle();

export interface IGroup {
	groupName: string;
	instances: IInstanceStatus[];
}

export interface IInstanceStatus {
	instanceName: string;
	state: string;
	healthStatus: string;
}

export class BdcDashboardResourceStatusPage {

	constructor(private model: BdcDashboardModel, private serviceName: string, private resourceName: string) {
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
	}

	public create(view: azdata.ModelView): azdata.FlexContainer {
		const rootContainer = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%',
				alignItems: 'left'
			}).component();

		const service = this.model.bdcStatus.services.find(s => s.serviceName === this.serviceName);
		const resource = service ? service.resources.find(r => r.resourceName === this.resourceName) : undefined;

		const propertiesLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status Details"), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
			.component();
		rootContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });


		const healthStatusTable = view.modelBuilder.table()
			.withProperties({
				columns: [
					localize('bdc.dashboard.resourceHealthStatusInstanceLabel', "Instance"),
					localize('bdc.dashboard.resourceHealthStatusStateLabel', "State"),
					localize('bdc.dashboard.resourceHealthStatusHealthStatusLabel', "Health Status")
				],
				data: resource && resource.instances ? resource.instances.map(i => [i.instanceName, i.state, i.healthStatus]) : [],
				height: 400,
				width: 375
			}).component();

		rootContainer.addItem(healthStatusTable, { CSSStyles: { 'padding-top': '10px' } });
		return rootContainer;
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {

	}
}

