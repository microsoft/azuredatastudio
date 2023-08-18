/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as constants from '../constants';
import * as Utils from '../utils';
import * as contracts from '../contracts';

import { AppContext } from '../appContext';
import { BaseService, ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';

export class QueryStoreService extends BaseService implements mssql.IQueryStoreService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends QueryStoreService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'queryStore')!.queryStore = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.QueryStoreService, this);
	}

	/**
	 * Gets the Regressed Queries summary
	 * @param connectionOwnerUri
	 * @param timeIntervalRecent
	 * @param timeIntervalHistory
	 * @param minExecutionCount
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getRegressedQueriesSummary(connectionOwnerUri: string, timeIntervalRecent: mssql.TimeInterval, timeIntervalHistory: mssql.TimeInterval, minExecutionCount: number, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetRegressedQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeIntervalRecent: timeIntervalRecent, timeIntervalHistory: timeIntervalHistory, minExecutionCount: minExecutionCount, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetRegressedQueriesSummaryRequest.type, params);
	}

	/**
	 * Gets the Regressed Queries summary
	 * @param connectionOwnerUri
	 * @param timeIntervalRecent
	 * @param timeIntervalHistory
	 * @param minExecutionCount
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getRegressedQueriesDetailedSummary(connectionOwnerUri: string, timeIntervalRecent: mssql.TimeInterval, timeIntervalHistory: mssql.TimeInterval, minExecutionCount: number, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetRegressedQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeIntervalRecent: timeIntervalRecent, timeIntervalHistory: timeIntervalHistory, minExecutionCount: minExecutionCount, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetRegressedQueriesDetailedSummaryRequest.type, params);
	}

	/**
	 * Gets the report for a Forced Plan Queries summary
	 * @param querySearchText
	 */
	public async getTrackedQueriesReport(querySearchText: string): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTrackedQueriesReportParams = { querySearchText: querySearchText };
		return await this.runWithErrorHandling(contracts.GetTrackedQueriesReportRequest.type, params);
	}

	/**
	 * Gets the High Variation Queries summary
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getHighVariationQueriesSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetHighVariationQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetHighVariationQueriesSummaryRequest.type, params);
	}

	/**
	 * Gets the High Variation Queries detailed summary
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getHighVariationQueriesDetailedSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetHighVariationQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetHighVariationQueriesDetailedSummaryRequest.type, params);
	}

	/**
	 * Gets the High Variation Queries detailed summary with wait stats
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getHighVariationQueriesDetailedSummaryWithWaitStats(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetHighVariationQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetHighVariationQueriesDetailedSummaryWithWaitStatsRequest.type, params);
	}

	/**
	 * Gets a Forced Plan Queries summary
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getTopResourceConsumersSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTopResourceConsumersReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetTopResourceConsumersSummaryRequest.type, params);
	}

	/**
	 * Gets a Forced Plan Queries detailed summary
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getTopResourceConsumersDetailedSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTopResourceConsumersReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetTopResourceConsumersDetailedSummaryRequest.type, params);
	}

	/**
	 * Gets a Forced Plan Queries detailed summary with wait stats
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getTopResourceConsumersDetailedSummaryWithWaitStats(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTopResourceConsumersReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetTopResourceConsumersDetailedSummaryWithWaitStatsRequest.type, params);
	}

	/**
	 * Gets the query for a Plan Summary chart view
	 * @param connectionOwnerUri
	 * @param queryId
	 * @param timeIntervalMode
	 * @param timeInterval
	 * @param selectedMetric
	 * @param selectedStatistic
	 */
	public async getPlanSummaryChartView(connectionOwnerUri: string, queryId: number, timeIntervalMode: mssql.PlanTimeIntervalMode, timeInterval: mssql.TimeInterval, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetPlanSummaryParams = { connectionOwnerUri: connectionOwnerUri, queryId: queryId, timeIntervalMode: timeIntervalMode, timeInterval: timeInterval, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic };
		return await this.runWithErrorHandling(contracts.GetPlanSummaryChartViewRequest.type, params);
	}

	/**
	 * Gets the query for a Plan Summary grid view
	 * @param connectionOwnerUri
	 * @param orderByColumnId
	 * @param descending
	 * @param queryId
	 * @param timeIntervalMode
	 * @param timeInterval
	 * @param selectedMetric
	 * @param selectedStatistic
	 */
	public async getPlanSummaryGridView(connectionOwnerUri: string, orderByColumnId: string, descending: boolean, queryId: number, timeIntervalMode: mssql.PlanTimeIntervalMode, timeInterval: mssql.TimeInterval, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetPlanSummaryGridViewParams = { connectionOwnerUri: connectionOwnerUri, orderByColumnId: orderByColumnId, descending: descending, queryId: queryId, timeIntervalMode: timeIntervalMode, timeInterval: timeInterval, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic };
		return await this.runWithErrorHandling(contracts.GetPlanSummaryGridViewRequest.type, params);
	}

	/**
	 * Gets the query for a forced plan query
	 * @param connectionOwnerUri
	 * @param queryId
	 * @param planId
	 */
	public async getForcedPlan(connectionOwnerUri: string, queryId: number, planId: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetForcedPlanParams = { connectionOwnerUri: connectionOwnerUri, queryId: queryId, planId: planId };
		return await this.runWithErrorHandling(contracts.GetForcedPlanRequest.type, params);
	}

	/**
	 * Gets the report for a Forced Plan Queries summary
	 * @param connectionOwnerUri
	 * @param timeInterval
	 * @param orderByColumnId
	 * @param descending
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getForcedPlanQueriesReport(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetForcedPlanQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetForcedPlanQueriesReportRequest.type, params);
	}

	/**
	 * Gets the report for a Forced Plan Queries summary
	 * @param connectionOwnerUri
	 * @param specifiedTimeInterval
	 * @param specifiedBucketInterval
	 * @param selectedMetric
	 * @param selectedStatistic
	 * @param topQueriesReturned
	 * @param returnAllQueries
	 * @param minNumberOfQueryPlans
	 */
	public async getOverallResourceConsumptionReport(connectionOwnerUri: string, specifiedTimeInterval: mssql.TimeInterval, specifiedBucketInterval: mssql.BucketInterval, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetOverallResourceConsumptionReportParams = { connectionOwnerUri: connectionOwnerUri, specifiedTimeInterval: specifiedTimeInterval, specifiedBucketInterval: specifiedBucketInterval, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetOverallResourceConsumptionReportRequest.type, params);
	}
}
