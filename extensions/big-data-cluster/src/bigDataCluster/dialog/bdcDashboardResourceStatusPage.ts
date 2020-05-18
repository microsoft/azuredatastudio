/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcStatusModel, InstanceStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { getHealthStatusDisplayText, getHealthStatusIcon, getStateDisplayText, Service } from '../utils';
import { cssStyles } from '../constants';
import { isNullOrUndefined } from 'util';
import { createViewDetailsButton } from './commonControls';
import { BdcDashboardPage } from './bdcDashboardPage';
import * as loc from '../localizedConstants';

export class BdcDashboardResourceStatusPage extends BdcDashboardPage {

	private resourceStatusModel: ResourceStatusModel;
	private rootContainer: azdata.FlexContainer;
	private instanceHealthStatusTable: azdata.DeclarativeTableComponent;
	private metricsAndLogsRowsTable: azdata.DeclarativeTableComponent;
	private lastUpdatedLabel: azdata.TextComponent;

	constructor(model: BdcDashboardModel, modelView: azdata.ModelView, serviceName: string, private resourceName: string) {
		super(model, modelView, serviceName);
		this.model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
	}

	public get container(): azdata.FlexContainer {
		// Lazily create the container only when needed
		if (!this.rootContainer) {
			// We do this here so that we can have the resource model to use for populating the data
			// in the tables. This is to get around a timing issue with ModelView tables
			this.updateResourceStatusModel(this.model.bdcStatus);
			this.createContainer();
		}
		return this.rootContainer;
	}

	private createContainer(): void {
		this.rootContainer = this.modelView.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		// ##############################
		// # INSTANCE HEALTH AND STATUS #
		// ##############################

		const healthStatusHeaderContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '20px' }).component();
		this.rootContainer.addItem(healthStatusHeaderContainer, { CSSStyles: { 'padding-left': '10px', 'padding-top': '15px' } });

		// Header label
		const healthStatusHeaderLabel = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: loc.healthStatusDetails,
				CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' }
			})
			.component();

		healthStatusHeaderContainer.addItem(healthStatusHeaderLabel, { CSSStyles: { ...cssStyles.title } });

		// Last updated label
		this.lastUpdatedLabel = this.modelView.modelBuilder.text()
			.withProperties({
				value: loc.lastUpdated(this.model.bdcStatusLastUpdated),
				CSSStyles: { ...cssStyles.lastUpdatedText }
			}).component();

		healthStatusHeaderContainer.addItem(this.lastUpdatedLabel, { CSSStyles: { 'margin-left': '45px' } });

		this.instanceHealthStatusTable = this.modelView.modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // status icon
							displayName: '',
							ariaLabel: loc.statusIcon,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 25,
							headerCssStyles: {
								'border': 'none'
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // instance
							displayName: loc.instance,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 100,
							headerCssStyles: {
								'border': 'none',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // state
							displayName: loc.state,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								'border': 'none',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // health status
							displayName: loc.healthStatus,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 100,
							headerCssStyles: {
								'border': 'none',
								'text-align': 'left',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							}
						},
						{ // view details button
							displayName: '',
							ariaLabel: loc.viewErrorDetails,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								'border': 'none'
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
					],
					data: this.createHealthStatusRows(),
					ariaLabel: loc.healthStatusDetails
				}).component();
		this.rootContainer.addItem(this.instanceHealthStatusTable, { flex: '0 0 auto' });

		// ####################
		// # METRICS AND LOGS #
		// ####################

		// Title label
		const endpointsLabel = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.metricsAndLogs, CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		this.rootContainer.addItem(endpointsLabel, { CSSStyles: { 'padding-left': '10px', ...cssStyles.title } });

		let metricsAndLogsColumns: azdata.DeclarativeTableColumn[] =
			[
				{ // instance
					displayName: loc.instance,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: 125,
					headerCssStyles: {
						'border': 'none',
						...cssStyles.tableHeader
					},
					rowCssStyles: {
						'border-top': 'solid 1px #ccc',
						'border-bottom': 'solid 1px #ccc',
						'border-left': 'none',
						'border-right': 'none'
					}
				},
				{ // node metrics
					displayName: loc.nodeMetrics,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 100,
					headerCssStyles: {
						'border': 'none',
						...cssStyles.tableHeader
					},
					rowCssStyles: {
						'border-top': 'solid 1px #ccc',
						'border-bottom': 'solid 1px #ccc',
						'border-left': 'none',
						'border-right': 'none'
					}
				}
			];

		// Only show SQL metrics column for SQL resource instances
		if (this.serviceName.toLowerCase() === Service.sql) {
			metricsAndLogsColumns.push(
				{ // sql metrics
					displayName: loc.sqlMetrics,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 100,
					headerCssStyles: {
						'border': 'none',
						'text-align': 'left',
						...cssStyles.tableHeader
					},
					rowCssStyles: {
						'border-top': 'solid 1px #ccc',
						'border-bottom': 'solid 1px #ccc',
						'border-left': 'none',
						'border-right': 'none'
					}
				});
		}

		metricsAndLogsColumns.push(
			{ // logs
				displayName: loc.logs,
				valueType: azdata.DeclarativeDataType.component,
				isReadOnly: true,
				width: 100,
				headerCssStyles: {
					'border': 'none',
					'text-align': 'left',
					...cssStyles.tableHeader
				},
				rowCssStyles: {
					'border-top': 'solid 1px #ccc',
					'border-bottom': 'solid 1px #ccc',
					'border-left': 'none',
					'border-right': 'none'
				}
			});

		this.metricsAndLogsRowsTable = this.modelView.modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: metricsAndLogsColumns,
					data: this.createMetricsAndLogsRows(),
					ariaLabel: loc.metricsAndLogs
				}).component();
		this.rootContainer.addItem(this.metricsAndLogsRowsTable, { flex: '0 0 auto' });
		this.initialized = true;
	}

	private updateResourceStatusModel(bdcStatus?: BdcStatusModel): void {
		// If we can't find the resource model for this resource then just
		// default to keeping what we had originally
		if (!bdcStatus) {
			return;
		}
		const service = bdcStatus.services ? bdcStatus.services.find(s => s.serviceName === this.serviceName) : undefined;
		this.resourceStatusModel = service ? service.resources.find(r => r.resourceName === this.resourceName) : this.resourceStatusModel;
	}

	private handleBdcStatusUpdate(bdcStatus?: BdcStatusModel): void {
		this.updateResourceStatusModel(bdcStatus);

		if (!this.resourceStatusModel || isNullOrUndefined(this.resourceStatusModel.instances)) {
			return;
		}

		this.lastUpdatedLabel.value = loc.lastUpdated(this.model.bdcStatusLastUpdated);

		this.instanceHealthStatusTable.data = this.createHealthStatusRows();

		this.metricsAndLogsRowsTable.data = this.createMetricsAndLogsRows();
	}

	private createMetricsAndLogsRows(): any[][] {
		return this.resourceStatusModel ? this.resourceStatusModel.instances.map(instanceStatus => this.createMetricsAndLogsRow(instanceStatus)) : [];
	}

	private createHealthStatusRows(): any[][] {
		return this.resourceStatusModel ? this.resourceStatusModel.instances.map(instanceStatus => this.createHealthStatusRow(instanceStatus)) : [];
	}

	private createMetricsAndLogsRow(instanceStatus: InstanceStatusModel): any[] {
		const row: any[] = [instanceStatus.instanceName];

		// Not all instances have all logs available - in that case just display N/A instead of a link
		if (isNullOrUndefined(instanceStatus.dashboards) || isNullOrUndefined(instanceStatus.dashboards.nodeMetricsUrl)) {
			row.push(this.modelView.modelBuilder.text().withProperties({ value: loc.notAvailable, CSSStyles: { ...cssStyles.text } }).component());
		} else {
			row.push(this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
				label: loc.view,
				url: instanceStatus.dashboards.nodeMetricsUrl,
				title: instanceStatus.dashboards.nodeMetricsUrl,
				ariaLabel: loc.viewNodeMetrics(instanceStatus.dashboards.nodeMetricsUrl),
				CSSStyles: { ...cssStyles.text }
			}).component());
		}

		// Only show SQL metrics column for SQL resource instances
		if (this.serviceName === Service.sql) {
			// Not all instances have all logs available - in that case just display N/A instead of a link
			if (isNullOrUndefined(instanceStatus.dashboards) || isNullOrUndefined(instanceStatus.dashboards.sqlMetricsUrl)) {
				row.push(this.modelView.modelBuilder.text().withProperties({ value: loc.notAvailable, CSSStyles: { ...cssStyles.text } }).component());
			} else {
				row.push(this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
					label: loc.view,
					url: instanceStatus.dashboards.sqlMetricsUrl,
					title: instanceStatus.dashboards.sqlMetricsUrl,
					ariaLabel: loc.viewSqlMetrics(instanceStatus.dashboards.sqlMetricsUrl),
					CSSStyles: { ...cssStyles.text }
				}).component());
			}
		}

		if (isNullOrUndefined(instanceStatus.dashboards) || isNullOrUndefined(instanceStatus.dashboards.logsUrl)) {
			row.push(this.modelView.modelBuilder.text().withProperties({ value: loc.notAvailable, CSSStyles: { ...cssStyles.text } }).component());
		} else {
			row.push(this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
				label: loc.view,
				url: instanceStatus.dashboards.logsUrl,
				title: instanceStatus.dashboards.logsUrl,
				ariaLabel: loc.viewLogs(instanceStatus.dashboards.logsUrl),
				CSSStyles: { ...cssStyles.text }
			}).component());
		}
		return row;
	}

	private createHealthStatusRow(instanceStatus: InstanceStatusModel): any[] {
		const statusIconCell = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: getHealthStatusIcon(instanceStatus.healthStatus),
				ariaRole: 'img',
				title: getHealthStatusDisplayText(instanceStatus.healthStatus),
				CSSStyles: { 'user-select': 'none', ...cssStyles.text }
			}).component();

		const viewDetailsButton = instanceStatus.healthStatus !== 'healthy' && instanceStatus.details && instanceStatus.details.length > 0 ? createViewDetailsButton(this.modelView.modelBuilder, instanceStatus.details) : undefined;
		return [
			statusIconCell,
			instanceStatus.instanceName,
			getStateDisplayText(instanceStatus.state),
			getHealthStatusDisplayText(instanceStatus.healthStatus),
			viewDetailsButton];
	}
}
