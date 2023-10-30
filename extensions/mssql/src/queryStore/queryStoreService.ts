/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	 * Gets the query for a Regressed Queries report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeIntervalRecent Time interval during which to look for performance regressions for the report
	 * @param timeIntervalHistory Time interval during which to establish baseline performance for the report
	 * @param minExecutionCount Minimum number of executions for a query to be included
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getRegressedQueriesSummary(connectionOwnerUri: string, timeIntervalRecent: mssql.TimeInterval, timeIntervalHistory: mssql.TimeInterval, minExecutionCount: number, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetRegressedQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeIntervalRecent: timeIntervalRecent, timeIntervalHistory: timeIntervalHistory, minExecutionCount: minExecutionCount, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetRegressedQueriesSummaryRequest.type, params);
	}

	/**
	 * Gets the query for a detailed Regressed Queries report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeIntervalRecent Time interval during which to look for performance regressions for the report
	 * @param timeIntervalHistory Time interval during which to establish baseline performance for the report
	 * @param minExecutionCount Minimum number of executions for a query to be included
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getRegressedQueriesDetailedSummary(connectionOwnerUri: string, timeIntervalRecent: mssql.TimeInterval, timeIntervalHistory: mssql.TimeInterval, minExecutionCount: number, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetRegressedQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeIntervalRecent: timeIntervalRecent, timeIntervalHistory: timeIntervalHistory, minExecutionCount: minExecutionCount, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetRegressedQueriesDetailedSummaryRequest.type, params);
	}

	/**
	 * Gets the query for a Tracked Queries report
	 * @param querySearchText Search text for a query
	 */
	public async getTrackedQueriesReport(querySearchText: string): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTrackedQueriesReportParams = { querySearchText: querySearchText };
		return await this.runWithErrorHandling(contracts.GetTrackedQueriesReportRequest.type, params);
	}

	/**
	 * Gets the query for a High Variation Queries report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeInterval Time interval for the report
	 * @param orderByColumnId Name of the column to order results by
	 * @param descending Direction of the result ordering
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getHighVariationQueriesSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetHighVariationQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetHighVariationQueriesSummaryRequest.type, params);
	}

	/**
	 * Gets the query for a detailed High Variation Queries report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeInterval Time interval for the report
	 * @param orderByColumnId Name of the column to order results by
	 * @param descending Direction of the result ordering
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getHighVariationQueriesDetailedSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetHighVariationQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetHighVariationQueriesDetailedSummaryRequest.type, params);
	}

	/**
	 * Gets the query for a Top Resource Consumers report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeInterval Time interval for the report
	 * @param orderByColumnId Name of the column to order results by
	 * @param descending Direction of the result ordering
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getTopResourceConsumersSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTopResourceConsumersReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetTopResourceConsumersSummaryRequest.type, params);
	}

	/**
	 * Gets the query for a detailed Top Resource Consumers report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeInterval Time interval for the report
	 * @param orderByColumnId Name of the column to order results by
	 * @param descending Direction of the result ordering
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getTopResourceConsumersDetailedSummary(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetTopResourceConsumersReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetTopResourceConsumersDetailedSummaryRequest.type, params);
	}

	/**
	 * Gets the query for a Plan Summary chart view
	 * @param connectionOwnerUri Connection URI for the database
	 * @param queryId Query ID to view a summary of plans for
	 * @param timeIntervalMode Mode of the time interval search
	 * @param timeInterval Time interval for the report
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 */
	public async getPlanSummaryChartView(connectionOwnerUri: string, queryId: number, timeIntervalMode: mssql.PlanTimeIntervalMode, timeInterval: mssql.TimeInterval, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetPlanSummaryParams = { connectionOwnerUri: connectionOwnerUri, queryId: queryId, timeIntervalMode: timeIntervalMode, timeInterval: timeInterval, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic };
		return await this.runWithErrorHandling(contracts.GetPlanSummaryChartViewRequest.type, params);
	}

	/**
	 * Gets the query for a Plan Summary grid view
	 * @param connectionOwnerUri Connection URI for the database
	 * @param orderByColumnId Name of the column to order results by
	 * @param descending Direction of the result ordering
	 * @param queryId Query ID to view a summary of plans for
	 * @param timeIntervalMode Mode of the time interval search
	 * @param timeInterval Time interval for the report
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 */
	public async getPlanSummaryGridView(connectionOwnerUri: string, orderByColumnId: string, descending: boolean, queryId: number, timeIntervalMode: mssql.PlanTimeIntervalMode, timeInterval: mssql.TimeInterval, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetPlanSummaryGridViewParams = { connectionOwnerUri: connectionOwnerUri, orderByColumnId: orderByColumnId, descending: descending, queryId: queryId, timeIntervalMode: timeIntervalMode, timeInterval: timeInterval, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic };
		return await this.runWithErrorHandling(contracts.GetPlanSummaryGridViewRequest.type, params);
	}

	/**
	 * Gets the query to view a forced plan
	 * @param connectionOwnerUri Connection URI for the database
	 * @param queryId Query ID to view the plan for
	 * @param planId Plan ID to view
	 */
	public async getForcedPlan(connectionOwnerUri: string, queryId: number, planId: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetForcedPlanParams = { connectionOwnerUri: connectionOwnerUri, queryId: queryId, planId: planId };
		return await this.runWithErrorHandling(contracts.GetForcedPlanRequest.type, params);
	}

	/**
	 * Gets the query for a Forced Plan Queries report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param timeInterval Time interval for the report
	 * @param orderByColumnId Name of the column to order results by
	 * @param descending Direction of the result ordering
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getForcedPlanQueriesReport(connectionOwnerUri: string, timeInterval: mssql.TimeInterval, orderByColumnId: string, descending: boolean, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetForcedPlanQueriesReportParams = { connectionOwnerUri: connectionOwnerUri, timeInterval: timeInterval, orderByColumnId: orderByColumnId, descending: descending, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetForcedPlanQueriesReportRequest.type, params);
	}

	/**
	 * Gets the query for an Overall Resource Consumption report
	 * @param connectionOwnerUri Connection URI for the database
	 * @param specifiedTimeInterval Time interval for the report
	 * @param specifiedBucketInterval Bucket interval for the report
	 * @param selectedMetric Metric to summarize
	 * @param selectedStatistic Statistic to calculate on SelecticMetric
	 * @param topQueriesReturned Number of queries to return if ReturnAllQueries is not set
	 * @param returnAllQueries True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 * @param minNumberOfQueryPlans Minimum number of query plans for a query to included in the report
	 */
	public async getOverallResourceConsumptionReport(connectionOwnerUri: string, specifiedTimeInterval: mssql.TimeInterval, specifiedBucketInterval: mssql.BucketInterval, selectedMetric: mssql.Metric, selectedStatistic: mssql.Statistic, topQueriesReturned: number, returnAllQueries: boolean, minNumberOfQueryPlans: number): Promise<mssql.QueryStoreQueryResult> {
		const params: contracts.GetOverallResourceConsumptionReportParams = { connectionOwnerUri: connectionOwnerUri, specifiedTimeInterval: specifiedTimeInterval, specifiedBucketInterval: specifiedBucketInterval, selectedMetric: selectedMetric, selectedStatistic: selectedStatistic, topQueriesReturned: topQueriesReturned, returnAllQueries: returnAllQueries, minNumberOfQueryPlans: minNumberOfQueryPlans };
		return await this.runWithErrorHandling(contracts.GetOverallResourceConsumptionReportRequest.type, params);
	}
}
