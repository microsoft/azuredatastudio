/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let imageBasePath = require.toUrl('./images/icons/');
export let executionPlanNodeIconPaths =
{
	// generic icons
	iteratorCatchAll: imageBasePath + 'iterator_catch_all.png',

	cursorCatchAll: imageBasePath + 'cursor_catch_all.png',

	languageConstructCatchAll: imageBasePath + 'language_construct_catch_all.png',

	// operator icons
	adaptiveJoin: imageBasePath + 'adaptive_join.png',

	assert: imageBasePath + 'assert.png',

	bitmap: imageBasePath + 'bitmap.png',

	clusteredIndexDelete: imageBasePath + 'clustered_index_delete.png',

	clusteredIndexInsert: imageBasePath + 'clustered_index_insert.png',

	clusteredIndexScan: imageBasePath + 'clustered_index_scan.png',

	clusteredIndexSeek: imageBasePath + 'clustered_index_seek.png',

	clusteredIndexUpdate: imageBasePath + 'clustered_index_update.png',

	clusteredIndexMerge: imageBasePath + 'clustered_index_merge.png',

	clusteredUpdate: imageBasePath + 'clustered_update.png',

	collapse: imageBasePath + 'collapse.png',

	computeScalar: imageBasePath + 'compute_scalar.png',

	concatenation: imageBasePath + 'concatenation.png',

	constantScan: imageBasePath + 'constant_scan.png',

	deletedScan: imageBasePath + 'deleted_scan.png',

	filter: imageBasePath + 'filter.png',

	hashMatch: imageBasePath + 'hash_match.png',

	indexDelete: imageBasePath + 'index_delete.png',

	indexInsert: imageBasePath + 'index_insert.png',

	indexScan: imageBasePath + 'index_scan.png',

	columnstoreIndexDelete: imageBasePath + 'columnstore_index_delete.png',

	columnstoreIndexInsert: imageBasePath + 'columnstore_index_insert.png',

	columnstoreIndexMerge: imageBasePath + 'columnstore_index_merge.png',

	columnstoreIndexScan: imageBasePath + 'columnstore_index_scan.png',

	columnstoreIndexUpdate: imageBasePath + 'columnstore_index_update.png',

	indexSeek: imageBasePath + 'index_seek.png',

	indexSpool: imageBasePath + 'index_spool.png',

	indexUpdate: imageBasePath + 'index_update.png',

	insertedScan: imageBasePath + 'inserted_scan.png',

	logRowScan: imageBasePath + 'log_row_scan.png',

	mergeInterval: imageBasePath + 'merge_interval.png',

	mergeJoin: imageBasePath + 'merge_join.png',

	nestedLoops: imageBasePath + 'nested_loops.png',

	parallelism: imageBasePath + 'parallelism.png',

	parameterTableScan: imageBasePath + 'parameter_table_scan.png',

	print: imageBasePath + 'print.png',

	rank: imageBasePath + 'rank.png',

	foreignKeyReferencesCheck: imageBasePath + 'foreign_key_references_check.png',

	remoteDelete: imageBasePath + 'remote_delete.png',

	remoteIndexScan: imageBasePath + 'remote_index_scan.png',

	remoteIndexSeek: imageBasePath + 'remote_index_seek.png',

	remoteInsert: imageBasePath + 'remote_insert.png',

	remoteQuery: imageBasePath + 'remote_query.png',

	remoteScan: imageBasePath + 'remote_scan.png',

	remoteUpdate: imageBasePath + 'remote_update.png',

	ridLookup: imageBasePath + 'rid_lookup.png',

	rowCountSpool: imageBasePath + 'row_count_spool.png',

	segment: imageBasePath + 'segment.png',

	sequence: imageBasePath + 'sequence.png',

	sequenceProject: imageBasePath + 'sequence_project.png',

	sort: imageBasePath + 'sort.png',

	split: imageBasePath + 'split.png',

	streamAggregate: imageBasePath + 'stream_aggregate.png',

	switchStatement: imageBasePath + 'switch.png',

	tableValuedFunction: imageBasePath + 'table_valued_function.png',

	tableDelete: imageBasePath + 'table_delete.png',

	tableInsert: imageBasePath + 'table_insert.png',

	tableScan: imageBasePath + 'table_scan.png',

	tableSpool: imageBasePath + 'table_spool.png',

	tableUpdate: imageBasePath + 'table_update.png',

	tableMerge: imageBasePath + 'table_merge.png',

	tfp: imageBasePath + 'predict.png',

	top: imageBasePath + 'top.png',

	udx: imageBasePath + 'udx.png',

	batchHashTableBuild: imageBasePath + 'batch_hash_table_build.png',

	windowSpool: imageBasePath + 'table_spool.png',

	windowAggregate: imageBasePath + 'window_aggregate.png',

	// cursor operators
	fetchQuery: imageBasePath + 'fetch_query.png',

	populateQuery: imageBasePath + 'population_query.png',

	refreshQuery: imageBasePath + 'refresh_query.png',

	// shiloh operators
	result: imageBasePath + 'result.png',

	aggregate: imageBasePath + 'aggregate.png',

	assign: imageBasePath + 'assign.png',

	arithmeticExpression: imageBasePath + 'arithmetic_expression.png',

	bookmarkLookup: imageBasePath + 'bookmark_lookup.png',

	convert: imageBasePath + 'convert.png',

	declare: imageBasePath + 'declare.png',

	deleteOperator: imageBasePath + 'delete.png',

	dynamic: imageBasePath + 'dynamic.png',

	hashMatchRoot: imageBasePath + 'hash_match_root.png',

	hashMatchTeam: imageBasePath + 'hash_match_team.png',

	ifOperator: imageBasePath + 'if.png',

	insert: imageBasePath + 'insert.png',

	intrinsic: imageBasePath + 'intrinsic.png',

	keyset: imageBasePath + 'keyset.png',

	locate: imageBasePath + 'locate.png',

	populationQuery: imageBasePath + 'population_query.png',

	setFunction: imageBasePath + 'set_function.png',

	snapshot: imageBasePath + 'snapshot.png',

	spool: imageBasePath + 'spool.png',

	tsql: imageBasePath + 'sql.png',

	update: imageBasePath + 'update.png',

	// fake operators
	keyLookup: imageBasePath + 'bookmark_lookup.png',

	// PDW operators
	apply: imageBasePath + 'apply.png',

	broadcast: imageBasePath + 'broadcast.png',

	computeToControlNode: imageBasePath + 'compute_to_control_node.png',

	constTableGet: imageBasePath + 'const_table_get.png',

	controlToComputeNodes: imageBasePath + 'control_to_compute_nodes.png',

	externalBroadcast: imageBasePath + 'external_broadcast.png',

	externalExport: imageBasePath + 'external_export.png',

	externalLocalStreaming: imageBasePath + 'external_local_streaming.png',

	externalRoundRobin: imageBasePath + 'external_round_robin.png',

	externalShuffle: imageBasePath + 'external_shuffle.png',

	get: imageBasePath + 'get.png',

	groupByApply: imageBasePath + 'apply.png',

	groupByAggregate: imageBasePath + 'group_by_aggregate.png',

	join: imageBasePath + 'join.png',

	localCube: imageBasePath + 'intrinsic.png',

	project: imageBasePath + 'project.png',

	shuffle: imageBasePath + 'shuffle.png',

	singleSourceRoundRobin: imageBasePath + 'single_source_round_robin.png',

	singleSourceShuffle: imageBasePath + 'single_source_shuffle.png',

	trim: imageBasePath + 'trim.png',

	union: imageBasePath + 'union.png',

	unionAll: imageBasePath + 'union_all.png'
};

export const badgeIconPaths = {
	warning: imageBasePath + 'badge_warning.svg',

	parallelism: imageBasePath + 'badge_parallelism.svg',

	criticalWarning: imageBasePath + 'badge_critical_warning.svg'
};

export const savePlanIconClassNames = 'ep-save-plan-icon';
export const openPropertiesIconClassNames = 'ep-open-properties-icon';
export const openQueryIconClassNames = 'ep-open-query-icon';
export const openPlanFileIconClassNames = 'ep-open-plan-file-icon';
export const saveIconClassNames = 'ep-save-icon';
export const searchIconClassNames = 'ep-search-icon';
export const sortAlphabeticallyIconClassNames = 'ep-sort-alphabetically-icon';
export const sortReverseAlphabeticallyIconClassNames = 'ep-sort-reverse-alphabetically-icon';
export const sortByDisplayOrderIconClassNames = 'ep-sort-display-order-icon';
export const zoomInIconClassNames = 'ep-zoom-in-icon';
export const zoomOutIconClassNames = 'ep-zoom-out-icon';
export const customZoomIconClassNames = 'ep-custom-zoom-icon';
export const zoomToFitIconClassNames = 'ep-zoom-to-fit-icon';
export const zoomIconClassNames = 'ep-zoom-icon';
export const enableTooltipIconClassName = 'ep-enable-tooltip-icon';
export const disableTooltipIconClassName = 'ep-disable-tooltip-icon';
export const addIconClassName = 'ep-add-icon';
export const settingsIconClassName = 'ep-settings-icon';
export const splitScreenHorizontallyIconClassName = 'ep-split-screen-horizontally-icon';
export const splitScreenVerticallyIconClassName = 'ep-split-screen-vertically-icon';
export const resetZoomIconClassName = 'ep-reset-zoom-icon';
export const executionPlanCompareIconClassName = 'ep-plan-compare-icon';
