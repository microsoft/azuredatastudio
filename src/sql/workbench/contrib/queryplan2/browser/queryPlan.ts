/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//import 'vs/css!./media/qp';
import * as azdata from 'azdata';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { Dimension, clearNode } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';

import * as azdataGraphModule from 'azdataGraph';
let azdataGraph = azdataGraphModule();

export class QueryPlan2Tab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', "Query Plan");
	public readonly identifier = 'QueryPlan2Tab';
	public readonly view: QueryPlan2View;

	constructor() {
		this.view = new QueryPlan2View();
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryPlan2View implements IPanelView {
	private qps?: QueryPlan2[] = [];
	private graphs?: azdata.QueryPlanGraph[] = [];
	private container = document.createElement('div');

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
		this.container.style.overflow = 'scroll';
	}

	dispose() {
		this.container.remove();
		delete this.qps;
		delete this.graphs;
	}

	public layout(dimension: Dimension): void {
		this.container.style.width = dimension.width + 'px';
		this.container.style.height = dimension.height + 'px';
	}

	public clear() {
		this.qps = [];
		this.graphs = [];
		clearNode(this.container);
	}

	public addGraphs(newGraphs: azdata.QueryPlanGraph[]) {
		newGraphs.forEach(g => {
			const qp2 = new QueryPlan2(this.container, this.qps.length + 1);
			qp2.graph = g;
			this.qps.push(qp2);
			this.graphs.push(g);
		});
	}
}

export class QueryPlan2 {
	private _graph?: azdata.QueryPlanGraph;

	private _iconMap: any = new Object();

	constructor(private container: HTMLElement, private graphIndex: number) {



                // new Operation("ClusteredUpdate",        SR.Keys.ClusteredUpdate,        SR.Keys.ClusteredUpdateDescription,         "Clustered_update_32x.ico"),
                // new Operation("Collapse",               SR.Keys.Collapse,               SR.Keys.CollapseDescription,                "Collapse_32x.ico"),
                // new Operation("ComputeScalar",          SR.Keys.ComputeScalar,          SR.Keys.ComputeScalarDescription,           "Compute_scalar_32x.ico"),
                // new Operation("Concatenation",          SR.Keys.Concatenation,          SR.Keys.ConcatenationDescription,           "Concatenation_32x.ico"),
                // new Operation("ConstantScan",           SR.Keys.ConstantScan,           SR.Keys.ConstantScanDescription,            "Constant_scan_32x.ico"),
                // new Operation("DeletedScan",            SR.Keys.DeletedScan,            SR.Keys.DeletedScanDescription,             "Deleted_scan_32x.ico"),
                // new Operation("Filter",                 SR.Keys.Filter,                 SR.Keys.FilterDescription,                  "Filter_32x.ico"),
                // new Operation("HashMatch",              SR.Keys.HashMatch,              SR.Keys.HashMatchDescription,               "Hash_match_32x.ico"),
                // new Operation("IndexDelete",            SR.Keys.IndexDelete,            SR.Keys.IndexDeleteDescription,             "Nonclust_index_delete_32x.ico"),
                // new Operation("IndexInsert",            SR.Keys.IndexInsert,            SR.Keys.IndexInsertDescription,             "Nonclust_index_insert_32x.ico"),
                // new Operation("IndexScan",              SR.Keys.IndexScan,              SR.Keys.IndexScanDescription,               "Nonclust_index_scan_32x.ico"),
                // new Operation("ColumnstoreIndexDelete", SR.Keys.ColumnstoreIndexDelete, SR.Keys.ColumnstoreIndexDeleteDescription,  "Columnstore_index_delete_32x.ico"),
                // new Operation("ColumnstoreIndexInsert", SR.Keys.ColumnstoreIndexInsert, SR.Keys.ColumnstoreIndexInsertDescription,  "Columnstore_index_insert_32x.ico"),
                // new Operation("ColumnstoreIndexMerge",  SR.Keys.ColumnstoreIndexMerge,  SR.Keys.ColumnstoreIndexMergeDescription,   "Columnstore_index_merge_32x.ico"),
                // new Operation("ColumnstoreIndexScan",   SR.Keys.ColumnstoreIndexScan,   SR.Keys.ColumnstoreIndexScanDescription,    "Columnstore_index_scan_32x.ico"),
                // new Operation("ColumnstoreIndexUpdate", SR.Keys.ColumnstoreIndexUpdate, SR.Keys.ColumnstoreIndexUpdateDescription,  "Columnstore_index_update_32x.ico"),
                // new Operation("IndexSeek",              SR.Keys.IndexSeek,              SR.Keys.IndexSeekDescription,               "Nonclust_index_seek_32x.ico"),
                // new Operation("IndexSpool",             SR.Keys.IndexSpool,             SR.Keys.IndexSpoolDescription,              "Nonclust_index_spool_32x.ico"),
                // new Operation("IndexUpdate",            SR.Keys.IndexUpdate,            SR.Keys.IndexUpdateDescription,             "Nonclust_index_update_32x.ico"),
                // new Operation("InsertedScan",           SR.Keys.InsertedScan,           SR.Keys.InsertedScanDescription,            "Inserted_scan_32x.ico"),
                // new Operation("LogRowScan",             SR.Keys.LogRowScan,             SR.Keys.LogRowScanDescription,              "Log_row_scan_32x.ico"),
                // new Operation("MergeInterval",          SR.Keys.MergeInterval,          SR.Keys.MergeIntervalDescription,           "Merge_interval_32x.ico"),
                // new Operation("MergeJoin",              SR.Keys.MergeJoin,              SR.Keys.MergeJoinDescription,               "Merge_join_32x.ico"),
                // new Operation("NestedLoops",            SR.Keys.NestedLoops,            SR.Keys.NestedLoopsDescription,             "Nested_loops_32x.ico"),
                // new Operation("Parallelism",            SR.Keys.Parallelism,            SR.Keys.ParallelismDescription,             "Parallelism_32x.ico"),
                // new Operation("ParameterTableScan",     SR.Keys.ParameterTableScan,     SR.Keys.ParameterTableScanDescription,      "Parameter_table_scan_32x.ico"),
                // new Operation("Print",                  SR.Keys.Print,                  SR.Keys.PrintDescription,                   "Print.ico"),
                // new Operation("Put",                    SR.Keys.Put,                    SR.Keys.PutDescription,                     "Put_32x.ico"),
                // new Operation("Rank",                   SR.Keys.Rank,                   SR.Keys.RankDescription,                    "Rank_32x.ico"),
                // // using the temporary icon as of now. Once the new icon is available, it will be updated.
                // new Operation("ForeignKeyReferencesCheck",  SR.Keys.ForeignKeyReferencesCheck,   SR.Keys.ForeignKeyReferencesCheckDescription, "Referential_Integrity_32x.ico"),
                // new Operation("RemoteDelete",           SR.Keys.RemoteDelete,           SR.Keys.RemoteDeleteDescription,            "Remote_delete_32x.ico"),
                // new Operation("RemoteIndexScan",        SR.Keys.RemoteIndexScan,        SR.Keys.RemoteIndexScanDescription,         "Remote_index_scan_32x.ico"),
                // new Operation("RemoteIndexSeek",        SR.Keys.RemoteIndexSeek,        SR.Keys.RemoteIndexSeekDescription,         "Remote_index_seek_32x.ico"),
                // new Operation("RemoteInsert",           SR.Keys.RemoteInsert,           SR.Keys.RemoteInsertDescription,            "Remote_insert_32x.ico"),
                // new Operation("RemoteQuery",            SR.Keys.RemoteQuery,            SR.Keys.RemoteQueryDescription,             "Remote_query_32x.ico"),
                // new Operation("RemoteScan",             SR.Keys.RemoteScan,             SR.Keys.RemoteScanDescription,              "Remote_scan_32x.ico"),
                // new Operation("RemoteUpdate",           SR.Keys.RemoteUpdate,           SR.Keys.RemoteUpdateDescription,            "Remote_update_32x.ico"),
                // new Operation("RIDLookup",              SR.Keys.RIDLookup,              SR.Keys.RIDLookupDescription,               "RID_clustered_locate_32x.ico"),
                // new Operation("RowCountSpool",          SR.Keys.RowCountSpool,          SR.Keys.RowCountSpoolDescription,           "Remote_count_spool_32x.ico"),
                // new Operation("Segment",                SR.Keys.Segment,                SR.Keys.SegmentDescription,                 "Segment_32x.ico"),
                // new Operation("Sequence",               SR.Keys.Sequence,               SR.Keys.SequenceDescription,                "Sequence_32x.ico"),
                // new Operation("SequenceProject",        SR.Keys.SequenceProject,        SR.Keys.SequenceProjectDescription,         "Sequence_project_32x.ico"),
                // new Operation("Sort",                   SR.Keys.Sort,                   SR.Keys.SortDescription,                    "Sort_32x.ico"),
                // new Operation("Split",                  SR.Keys.Split,                  SR.Keys.SplitDescription,                   "Split_32x.ico"),
                // new Operation("StreamAggregate",        SR.Keys.StreamAggregate,        SR.Keys.StreamAggregateDescription,         "Stream_aggregate_32x.ico"),
                // new Operation("Switch",                 SR.Keys.Switch,                 SR.Keys.SwitchDescription,                  "Switch_32x.ico"),
                // new Operation("Tablevaluedfunction",    SR.Keys.TableValueFunction,     SR.Keys.TableValueFunctionDescription,      "Table_value_function_32x.ico"),
                // new Operation("TableDelete",            SR.Keys.TableDelete,            SR.Keys.TableDeleteDescription,             "Table_delete_32x.ico"),
                // new Operation("TableInsert",            SR.Keys.TableInsert,            SR.Keys.TableInsertDescription,             "Table_insert_32x.ico"),
                // new Operation("TableScan",              SR.Keys.TableScan,              SR.Keys.TableScanDescription,               "Table_scan_32x.ico"),
                // new Operation("TableSpool",             SR.Keys.TableSpool,             SR.Keys.TableSpoolDescription,              "Table_spool_32x.ico"),
                // new Operation("TableUpdate",            SR.Keys.TableUpdate,            SR.Keys.TableUpdateDescription,             "Table_update_32x.ico"),
                // new Operation("TableMerge",             SR.Keys.TableMerge,             SR.Keys.TableMergeDescription,              "Table_merge_32x.ico"),
                // new Operation("TFP",                    SR.Keys.TFP,                    SR.Keys.TFPDescription,                     "Predict_32x.ico"),
                // new Operation("Top",                    SR.Keys.Top,                    SR.Keys.TopDescription,                     "Top_32x.ico"),
                // new Operation("UDX",                    SR.Keys.UDX,                    SR.Keys.UDXDescription,                     "UDX_32x.ico"),
                // new Operation("BatchHashTableBuild",    SR.Keys.BatchHashTableBuild,    SR.Keys.BatchHashTableBuildDescription,     "BatchHashTableBuild_32x.ico"),
                // new Operation("WindowSpool",            SR.Keys.Window,                 SR.Keys.WindowDescription,                  "Table_spool_32x.ico"),
                // new Operation("WindowAggregate",        SR.Keys.WindowAggregate,        SR.Keys.WindowAggregateDescription,         "Window_aggregate_32x.ico"),

                // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // /// XML ShowPlan Cursor Operators (see showplanxml.cs for the list)
                // /// Name / Type                         SR Display Name Key             SR Description Key                          Image
                // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

                // new Operation("FetchQuery",             SR.Keys.FetchQuery,             SR.Keys.FetchQueryDescription,              "Fetch_query_32x.ico"),
                // new Operation("PopulateQuery",          SR.Keys.PopulationQuery,        SR.Keys.PopulationQueryDescription,         "Population_query_32x.ico"),
                // new Operation("RefreshQuery",           SR.Keys.RefreshQuery,           SR.Keys.RefreshQueryDescription,            "Refresh_query_32x.ico"),

                // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // /// Shiloh Operators (see star\sqlquery\src\plan.cpp for the list)
                // /// Name / Type                         SR Display Name Key             SR Description Key                          Image
                // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // new Operation("Result",                 SR.Keys.Result,                 SR.Keys.ResultDescription,                  "Result_32x.ico"),
                // new Operation("Aggregate",              SR.Keys.Aggregate,              SR.Keys.AggregateDescription,               "Aggregate_32x.ico"),
                // new Operation("Assign",                 SR.Keys.Assign,                 SR.Keys.AssignDescription,                  "Assign_32x.ico"),
                // new Operation("ArithmeticExpression",   SR.Keys.ArithmeticExpression,   SR.Keys.ArithmeticExpressionDescription,    "Arithmetic_expression_32x.ico"),
                // new Operation("BookmarkLookup",         SR.Keys.BookmarkLookup,         SR.Keys.BookmarkLookupDescription,          "Bookmark_lookup_32x.ico"),
                // new Operation("Convert",                SR.Keys.Convert,                SR.Keys.ConvertDescription,                 "Convert_32x.ico"),
                // new Operation("Declare",                SR.Keys.Declare,                SR.Keys.DeclareDescription,                 "Declare_32x.ico"),
                // new Operation("Delete",                 SR.Keys.Delete,                 SR.Keys.DeleteDescription,                  "Delete_32x.ico"),
                // new Operation("Dynamic",                SR.Keys.Dynamic,                SR.Keys.DynamicDescription,                 "Dynamic_32x.ico"),
                // new Operation("HashMatchRoot",          SR.Keys.HashMatchRoot,          SR.Keys.HashMatchRootDescription,           "Hash_match_root_32x.ico"),
                // new Operation("HashMatchTeam",          SR.Keys.HashMatchTeam,          SR.Keys.HashMatchTeamDescription,           "Hash_match_team_32x.ico"),
                // new Operation("If",                     SR.Keys.If,                     SR.Keys.IfDescription,                      "If_32x.ico"),
                // new Operation("Insert",                 SR.Keys.Insert,                 SR.Keys.InsertDescription,                  "Insert_32x.ico"),
                // new Operation("Intrinsic",              SR.Keys.Intrinsic,              SR.Keys.IntrinsicDescription,               "Intrinsic_32x.ico"),
                // new Operation("Keyset",                 SR.Keys.Keyset,                 SR.Keys.KeysetDescription,                  "Keyset_32x.ico"),
                // new Operation("Locate",                 SR.Keys.Locate,                 SR.Keys.LocateDescription,                  "RID_nonclustered_locate_32x.ico"),
                // new Operation("PopulationQuery",        SR.Keys.PopulationQuery,        SR.Keys.PopulationQueryDescription,         "Population_query_32x.ico"),
                // new Operation("SetFunction",            SR.Keys.SetFunction,            SR.Keys.SetFunctionDescription,             "Set_function_32x.ico"),
                // new Operation("Snapshot",               SR.Keys.Snapshot,               SR.Keys.SnapshotDescription,                "Snapshot_32x.ico"),
                // new Operation("Spool",                  SR.Keys.Spool,                  SR.Keys.SpoolDescription,                   "Spool_32x.ico"),
                // new Operation("TSQL",                   SR.Keys.SQL,                    SR.Keys.SQLDescription,                     "SQL_32x.ico"),
                // new Operation("Update",                 SR.Keys.Update,                 SR.Keys.UpdateDescription,                  "Update_32x.ico"),

                // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // /// Fake Operators - Used to special case existing operators and expose them using different name / icons (see sqlbu#434739)
                // /// Name / Type                         SR Display Name Key             SR Description Key                          Image
                // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // new Operation("KeyLookup",              SR.Keys.KeyLookup,              SR.Keys.KeyLookupDescription,               "Bookmark_lookup_32x.ico"),

                // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // /// PDW Operators (See PDW comment tags in showplanxml.xsd)
                // /// Name / Type                         SR Display Name Key             SR Description Key                          Image
                // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // new Operation("Apply",                  SR.Keys.Apply,                  SR.Keys.ApplyDescription,                   "Apply_32x.ico"),
                // new Operation("Broadcast",              SR.Keys.Broadcast,              SR.Keys.BroadcastDescription,               "Broadcast_32x.ico"),
                // new Operation("ComputeToControlNode",   SR.Keys.ComputeToControlNode,   SR.Keys.ComputeToControlNodeDescription,    "Compute_to_control_32x.ico"),
                // new Operation("ConstTableGet",          SR.Keys.ConstTableGet,          SR.Keys.ConstTableGetDescription,           "Const_table_get_32x.ico"),
                // new Operation("ControlToComputeNodes",  SR.Keys.ControlToComputeNodes,  SR.Keys.ControlToComputeNodesDescription,   "Control_to_compute_32x.ico"),
                // new Operation("ExternalBroadcast",      SR.Keys.ExternalBroadcast,      SR.Keys.ExternalBroadcastDescription,       "External_broadcast_32x.ico"),
                // new Operation("ExternalExport",         SR.Keys.ExternalExport,         SR.Keys.ExternalExportDescription,          "External_export_32x.ico"),
                // new Operation("ExternalLocalStreaming", SR.Keys.ExternalLocalStreaming, SR.Keys.ExternalLocalStreamingDescription,  "External_local_streaming_32x.ico"),
                // new Operation("ExternalRoundRobin",     SR.Keys.ExternalRoundRobin,     SR.Keys.ExternalRoundRobinDescription,      "External_round_robin_32x.ico"),
                // new Operation("ExternalShuffle",        SR.Keys.ExternalShuffle,        SR.Keys.ExternalShuffleDescription,         "External_shuffle_32x.ico"),
                // new Operation("Get",                    SR.Keys.Get,                    SR.Keys.GetDescription,                     "Get_32x.ico"),
                // new Operation("GbApply",                SR.Keys.GbApply,                SR.Keys.GbApplyDescription,                 "Apply_32x.ico"),
                // new Operation("GbAgg",                  SR.Keys.GbAgg,                  SR.Keys.GbAggDescription,                   "Group_by_aggregate_32x.ico"),
                // new Operation("Join",                   SR.Keys.Join,                   SR.Keys.JoinDescription,                    "Join_32x.ico"),
                // new Operation("LocalCube",              SR.Keys.LocalCube,              SR.Keys.LocalCubeDescription,               "Intrinsic_32x.ico"),
                // new Operation("Project",                SR.Keys.Project,                SR.Keys.ProjectDescription,                 "Project_32x.ico"),
                // new Operation("Shuffle",                SR.Keys.Shuffle,                SR.Keys.ShuffleDescription,                 "Shuffle_32x.ico"),
                // new Operation("SingleSourceRoundRobin", SR.Keys.SingleSourceRoundRobin, SR.Keys.SingleSourceRoundRobinDescription,  "Single_source_round_robin_32x.ico"),
                // new Operation("SingleSourceShuffle",    SR.Keys.SingleSourceShuffle,    SR.Keys.SingleSourceShuffleDescription,     "Single_source_shuffle_32x.ico"),
                // new Operation("Trim",                   SR.Keys.Trim,                   SR.Keys.TrimDescription,                    "Trim_32x.ico"),
                // new Operation("Union",                  SR.Keys.Union,                  SR.Keys.UnionDescription,                   "Union_32x.ico"),
                // new Operation("UnionAll",               SR.Keys.UnionAll,               SR.Keys.UnionAllDescription,                "Union_all_32x.ico"),


		this._iconMap['Adaptive_Join_32x.ico'] = 'adaptiveJoin';
		this._iconMap['Assert_32x.ico'] = 'assert';
		this._iconMap['Bitmap_32x.ico'] = 'bitmap';
		this._iconMap['Clustered_index_delete_32x.ico'] = 'clusteredIndexDelete';
		this._iconMap['Clustered_index_insert_32x.ico'] = 'ClusteredIndexInsert';
		this._iconMap['Clustered_index_scan_32x.ico'] = 'ClusteredIndexScan';
		this._iconMap['Clustered_index_seek_32x.ico'] = 'ClusteredIndexSeek';
		this._iconMap['Clustered_index_update_32x.ico'] = 'ClusteredIndexUpdate';
		this._iconMap['Clustered_index_merge_32x.icoo'] = 'ClusteredIndexMerge';


		this._iconMap['Filter_32x.ico'] = 'filter';
		this._iconMap['Clustered_index_scan_32x.ico'] = 'clusteredIndexScan';
		this._iconMap['Clustered_index_seek_32x.ico'] = 'clusteredIndexSeek';
		this._iconMap['Compute_scalar_32x.ico'] = 'computeScalar';
		this._iconMap['Concatenation_32x.ico'] = 'concatenation';

		this._iconMap['Concatenation_32x.ico'] = 'concatenation';

		this._iconMap['Nested_loops_32x.ico'] = 'nestedLoops';
		this._iconMap['Result_32x.ico'] = 'result';
		this._iconMap['Table_spool_32x.ico'] = 'tableSpool';
		this._iconMap['Top_32x.ico'] = 'top';


		// var azdataQueryPlanIconPaths =
		// {
		// 	// generic icons
		// 	iteratorCatchAll:  imageBasePath + "iterator_catch_all.png",

		// 	cursorCatchAll:  imageBasePath + "cursor_catch_all.png",

		// 	languageConstructCatchAll:  imageBasePath + "language_construct_catch_all.png",

		// 	// operator icons
		// 	adaptiveJoin:  imageBasePath + "adaptive_join.png",

		// 	assert:  imageBasePath + "assert.png",

		// 	bitmap:  imageBasePath + "bitmap.png",

		// 	clusteredIndexDelete:  imageBasePath + "clustered_index_delete.png",

		// 	clusteredIndexInsert:  imageBasePath + "clustered_index_insert.png",

		// 	clusteredIndexScan:  imageBasePath + "clustered_index_scan.png",

		// 	clusteredIndexSeek:  imageBasePath + "clustered_index_seek.png",

		// 	clusteredIndexUpdate:  imageBasePath + "clustered_index_update.png",

		// 	clusteredIndexMerge:  imageBasePath + "clustered_index_merge.png",

		// 	clusteredUpdate:  imageBasePath + "clustered_update.png",

		// 	collapse:  imageBasePath + "collapse.png",

		// 	computeScalar:  imageBasePath + "compute_scalar.png",

		// 	concatenation:  imageBasePath + "concatenation.png",

		// 	constantScan:  imageBasePath + "constant_scan.png",

		// 	deletedScan:  imageBasePath + "deleted_scan.png",

		// 	filter:  imageBasePath + "filter.png",

		// 	hashMatch:  imageBasePath + "hash_match.png",

		// 	indexDelete:  imageBasePath + "index_delete.png",

		// 	indexInsert:  imageBasePath + "index_insert.png",

		// 	indexScan:  imageBasePath + "index_scan.png",

		// 	columnstoreIndexDelete:  imageBasePath + "columnstore_index_delete.png",

		// 	columnstoreIndexInsert:  imageBasePath + "columnstore_index_insert.png",

		// 	columnstoreIndexMerge:  imageBasePath + "columnstore_index_merge.png",

		// 	columnstoreIndexScan:  imageBasePath + "columnstore_index_scan.png",

		// 	columnstoreIndexUpdate:  imageBasePath + "columnstore_index_update.png",

		// 	indexSeek:  imageBasePath + "index_seek.png",

		// 	indexSpool:  imageBasePath + "index_spool.png",

		// 	indexUpdate:  imageBasePath + "index_update.png",

		// 	insertedScan:  imageBasePath + "inserted_scan.png",

		// 	logRowScan:  imageBasePath + "log_row_scan.png",

		// 	mergeInterval:  imageBasePath + "merge_interval.png",

		// 	mergeJoin:  imageBasePath + "merge_join.png",

		// 	nestedLoops:  imageBasePath + "nested_loops.png",

		// 	parallelism:  imageBasePath + "parallelism.png",

		// 	parameterTableScan:  imageBasePath + "parameter_table_scan.png",

		// 	print:  imageBasePath + "print.png",

		// 	rank:  imageBasePath + "rank.png",

		// 	foreignKeyReferencesCheck:  imageBasePath + "foreign_key_references_check.png",

		// 	remoteDelete:  imageBasePath + "remote_delete.png",

		// 	remoteIndexScan:  imageBasePath + "remote_index_scan.png",

		// 	remoteIndexSeek:  imageBasePath + "remote_index_seek.png",

		// 	remoteInsert:  imageBasePath + "remote_insert.png",

		// 	remoteQuery:  imageBasePath + "remote_query.png",

		// 	remoteScan:  imageBasePath + "remote_scan.png",

		// 	remoteUpdate:  imageBasePath + "remote_update.png",

		// 	ridLookup:  imageBasePath + "rid_lookup.png",

		// 	rowCountSpool:  imageBasePath + "row_count_spool.png",

		// 	segment:  imageBasePath + "segment.png",

		// 	sequence:  imageBasePath + "sequence.png",

		// 	sequenceProject:  imageBasePath + "sequence_project.png",

		// 	sort:  imageBasePath + "sort.png",

		// 	split:  imageBasePath + "split.png",

		// 	streamAggregate:  imageBasePath + "stream_aggregate.png",

		// 	switchStatement:  imageBasePath + "switch.png",

		// 	tableValuedFunction:  imageBasePath + "table_valued_function.png",

		// 	tableDelete:  imageBasePath + "table_delete.png",

		// 	tableInsert:  imageBasePath + "table_insert.png",

		// 	tableScan:  imageBasePath + "table_scan.png",

		// 	tableSpool:  imageBasePath + "table_spool.png",

		// 	tableUpdate:  imageBasePath + "table_update.png",

		// 	tableMerge:  imageBasePath + "table_merge.png",

		// 	tfp:  imageBasePath + "predict.png",

		// 	top:  imageBasePath + "top.png",

		// 	udx:  imageBasePath + "udx.png",

		// 	batchHashTableBuild:  imageBasePath + "batch_hash_table_build.png",

		// 	windowSpool:  imageBasePath + "table_spool.png",

		// 	windowAggregate:  imageBasePath + "window_aggregate.png",

		// 	// cursor operators
		// 	fetchQuery:  imageBasePath + "fetch_query.png",

		// 	populateQuery:  imageBasePath + "population_query.png",

		// 	refreshQuery:  imageBasePath + "refresh_query.png",

		// 	// shiloh operators
		// 	result:  imageBasePath + "result.png",

		// 	aggregate:  imageBasePath + "aggregate.png",

		// 	assign:  imageBasePath + "assign.png",

		// 	arithmeticExpression:  imageBasePath + "arithmetic_expression.png",

		// 	bookmarkLookup:  imageBasePath + "bookmark_lookup.png",

		// 	convert:  imageBasePath + "convert.png",

		// 	declare:  imageBasePath + "declare.png",

		// 	deleteOperator:  imageBasePath + "delete.png",

		// 	dynamic:  imageBasePath + "dynamic.png",

		// 	hashMatchRoot:  imageBasePath + "hash_match_root.png",

		// 	hashMatchTeam:  imageBasePath + "hash_match_team.png",

		// 	ifOperator:  imageBasePath + "if.png",

		// 	insert:  imageBasePath + "insert.png",

		// 	intrinsic:  imageBasePath + "intrinsic.png",

		// 	keyset:  imageBasePath + "keyset.png",

		// 	locate:  imageBasePath + "locate.png",

		// 	populationQuery:  imageBasePath + "population_query.png",

		// 	setFunction:  imageBasePath + "set_function.png",

		// 	snapshot:  imageBasePath + "snapshot.png",

		// 	spool:  imageBasePath + "spool.png",

		// 	tsql:  imageBasePath + "sql.png",

		// 	update:  imageBasePath + "update.png",

		// 	// fake operators
		// 	keyLookup:  imageBasePath + "bookmark_lookup.png",

		// 	// PDW operators
		// 	apply:  imageBasePath + "apply.png",

		// 	broadcast:  imageBasePath + "broadcast.png",

		// 	computeToControlNode:  imageBasePath + "compute_to_control_node.png",

		// 	constTableGet:  imageBasePath + "const_table_get.png",

		// 	controlToComputeNodes:  imageBasePath + "control_to_compute_nodes.png",

		// 	externalBroadcast:  imageBasePath + "external_broadcast.png",

		// 	externalExport:  imageBasePath + "external_export.png",

		// 	externalLocalStreaming:  imageBasePath + "external_local_streaming.png",

		// 	externalRoundRobin:  imageBasePath + "external_round_robin.png",

		// 	externalShuffle:  imageBasePath + "external_shuffle.png",

		// 	get:  imageBasePath + "get.png",

		// 	groupByApply:  imageBasePath + "apply.png",

		// 	groupByAggregate:  imageBasePath + "group_by_aggregate.png",

		// 	join:  imageBasePath + "join.png",

		// 	localCube:  imageBasePath + "intrinsic.png",

		// 	project:  imageBasePath + "project.png",

		// 	shuffle:  imageBasePath + "shuffle.png",

		// 	singleSourceRoundRobin:  imageBasePath + "single_source_round_robin.png",

		// 	singleSourceShuffle:  imageBasePath + "single_source_shuffle.png",

		// 	trim:  imageBasePath + "trim.png",

		// 	union:  imageBasePath + "union.png",

		// 	unionAll:  imageBasePath + "union_all.png"
		// };




	}


	private populate(node: azdata.QueryPlanGraphNode, diagramNode: any): any {
		diagramNode.label = node.name;

		let icon = this._iconMap[node.type];
		if (icon) {
			diagramNode.icon = icon;
		}

		if (node.children) {
			diagramNode.children = [];
			for (let i = 0; i < node.children.length; ++i) {
				diagramNode.children.push(this.populate(node.children[i], new Object()));
			}
		}
		return diagramNode;
	}

	private createPlanDiagram(container: HTMLDivElement): void {
		let diagramRoot: any = new Object();
		let graphRoot: azdata.QueryPlanGraphNode = this._graph.root;
		this.populate(graphRoot, diagramRoot);

		// let diagram_stack = [new Object() ];
		// let node_stack = [ this._graph.root ];
		// while (node_stack.length > 0) {
		// 	let node = node_stack.pop();
		// 	let diagramNode: any = diagram_stack.pop();
		// 	if (node) {
		// 		diagramNode.label = node.name;
		// 		if (node.edges) {
		// 			for (let i = 0; i < node.edges.length; ++i) {
		// 			}
		// 		}
		// 	}
		// }

		// let root = {
		// 	icon: 'temp.png',
		// 	label: 'abc',
		// 	metrics: [
		// 		{ name: 'CPU', value: '10 MS' },
		// 		{ name: 'Memory', value: '5 MB' },
		// 		{ name: 'Rows', value: '6' },
		// 	],
		// 	children: [ n1 ]
		// };

		new azdataGraph.azdataQueryPlan(container, diagramRoot);
	}

	public set graph(graph: azdata.QueryPlanGraph | undefined) {
		this._graph = graph;
		if (this._graph) {
			/**
			 * Create a show plan graph here.
			 */
			this.container.appendChild(document.createElement('hr'));
			this.container.appendChild(document.createTextNode(localize("qp2.grpah", 'Query {0}: Query Cost (Relative to the batch): {1}%', this.graphIndex, converDecimalToPercentage(this.graph.root.subTreeCost))));
			this.container.appendChild(document.createElement('br'));
			this.container.appendChild(document.createTextNode(graph.query));
			this.container.appendChild(document.createElement('br'));
			this.container.appendChild(document.createElement('hr'));

			let diagramContainer = document.createElement('div');
			this.createPlanDiagram(diagramContainer);
			this.container.appendChild(diagramContainer);

			this.container.appendChild(document.createElement('br'));
		}
	}

	public get graph(): azdata.QueryPlanGraph | undefined {
		return this._graph;
	}

}

function converDecimalToPercentage(cost: number): number {
	return +(cost * 100).toFixed(2);
}

/**
 * Registering a feature flag for query plan. This should be removed before taking the feature to public preview.
 */
const QUERYPLAN2_CONFIG_ID = 'queryPlan2';

Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration).registerConfiguration({
	id: QUERYPLAN2_CONFIG_ID,
	title: localize('queryPlan2.configTitle', "Query Plan"),
	type: 'object',
	properties: {
		'queryPlan2.enableFeature': {
			'type': 'boolean',
			'default': false,
			'description': localize('queryPlan2.featureEnabledDescription', "Controls whether the new query plan feature is enabled. Default value is false.")
		}
	}
});


