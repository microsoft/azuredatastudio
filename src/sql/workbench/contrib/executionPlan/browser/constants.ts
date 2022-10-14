/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

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

export const collapseExpandNodeIconPaths = {
	collapse: imageBasePath + 'collapse.svg',
	expand: imageBasePath + 'expand.svg'
};

export const savePlanIconClassNames = 'ep-save-plan-icon';
export const highlightExpensiveOperationClassNames = 'ep-highlight-expensive-operation-icon';
export const openPropertiesIconClassNames = 'ep-open-properties-icon';
export const openQueryIconClassNames = 'ep-open-query-icon';
export const openPlanFileIconClassNames = 'ep-open-plan-file-icon';
export const saveIconClassNames = 'ep-save-icon';
export const searchIconClassNames = 'ep-search-icon';
export const filterIconClassNames = 'ep-filter-icon';
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
export const executionPlanComparisonPropertiesDifferent = 'ep-properties-different';
export const executionPlanComparisonPropertiesDownArrow = 'ep-properties-down-arrow';
export const executionPlanComparisonPropertiesUpArrow = 'ep-properties-up-arrow';
export const executionPlanTopOperations = 'ep-top-operations';

/**
 * Plan comparison polygon border colors
 */
export const polygonBorderColor: string[] = [
	`rgba(0, 188, 242)`,    // "themeMain blue"
	`rgba(236, 0, 140)`,    // "themeError pink"
	`rgba(0, 216, 204)`,    // "h2 blue"
	`rgba(236, 0, 140)`,    // "b0 orange"
	`rgba(255, 140, 0)`,    // "themeWarning orange"
	`rgba(127, 186, 0)`,    // "themeSuccess green"
	`rgba(252, 214, 241)`,  // "paletteDiffDel light pink"
	`rgba(252, 209, 22)`,   // "a1 gold"
	`rgba(68,35,89)`,       // "e1 dark purple"
	`rgba(0, 114, 198)`,    // "g1 blue"
	`rgba(160, 165, 168)`,  // "i1 green"
	`rgba(255, 140, 0)`,    // "k1 grey"
	`rgba(199, 241, 199)`,  // "paletteDiffAdd light green"
	`rgba(0, 24, 143)`,     // "d0 pink",
	`rgba(186, 216, 10)`,   // "f0 royal blue"
	`rgba(255, 252, 158)`,  // "h0 seafoam green"
	`rgba(221, 89, 0)`,     // "j0 yellow green"
	`rgba(155, 79, 150)`,   // "a2 light yellow"
	`rgba(109, 194, 233)`,  // "c2 burnt orange"
	`rgba(85, 212, 85)`,    // "e2 purple"
	`rgba(180, 0, 158)`,    // "d1 purple"
	`rgba(0, 32, 80)`,      // "f1 navy blue"
	`rgba(0, 130, 114)`,    // "h1 blue green"
	`rgba(127, 186, 0)`,    // "j1 yellow green"
	`rgba(255, 241, 0)`,    // "a0 bright yellow"
	`rgba(104, 33, 122)`,   // "e0 purple"
	`rgba(0, 188, 242)`,    // "g0 sky blue"
	`rgba(0, 158, 73)`,     // "i0 green"
	`rgba(187, 194, 202)`,  // "k0 grey"
	`rgba(255, 185, 0)`,    // "b2 gold"
	`rgba(244, 114, 208)`,  // "d2 pink"
	`rgba(70, 104, 197)`,   // "f2 blue purple"
	`rgba(226, 229, 132)`,  // "j2 khaki"
];

/**
 * Plan comparison polygon fill colors
 */
export const polygonFillColor: string[] = [
	`rgba(0, 188, 242, 0.1)`,    // "themeMain blue"
	`rgba(236, 0, 140, 0.1)`,    // "themeError pink"
	`rgba(0, 216, 204, 0.1)`,    // "h2 blue"
	`rgba(236, 0, 140, 0.1)`,    // "b0 orange"
	`rgba(255, 140, 0, 0.1)`,    // "themeWarning orange"
	`rgba(127, 186, 0, 0.1)`,    // "themeSuccess green"
	`rgba(252, 214, 241, 0.1)`,  // "paletteDiffDel light pink"
	`rgba(252, 209, 22, 0.1)`,   // "a1 gold"
	`rgba(68,35,89, 0.1)`,       // "e1 dark purple"
	`rgba(0, 114, 198, 0.1)`,    // "g1 blue"
	`rgba(160, 165, 168, 0.1)`,  // "i1 green"
	`rgba(255, 140, 0, 0.1)`,    // "k1 grey"
	`rgba(199, 241, 199, 0.1)`,  // "paletteDiffAdd light green"
	`rgba(0, 24, 143, 0.1)`,     // "d0 pink",
	`rgba(186, 216, 10, 0.1)`,   // "f0 royal blue"
	`rgba(255, 252, 158, 0.1)`,  // "h0 seafoam green"
	`rgba(221, 89, 0, 0.1)`,     // "j0 yellow green"
	`rgba(155, 79, 150, 0.1)`,   // "a2 light yellow"
	`rgba(109, 194, 233, 0.1)`,  // "c2 burnt orange"
	`rgba(85, 212, 85, 0.1)`,    // "e2 purple"
	`rgba(180, 0, 158, 0.1)`,    // "d1 purple"
	`rgba(0, 32, 80, 0.1)`,      // "f1 navy blue"
	`rgba(0, 130, 114, 0.1)`,    // "h1 blue green"
	`rgba(127, 186, 0, 0.1)`,    // "j1 yellow green"
	`rgba(255, 241, 0, 0.1)`,    // "a0 bright yellow"
	`rgba(104, 33, 122, 0.1)`,   // "e0 purple"
	`rgba(0, 188, 242, 0.1)`,    // "g0 sky blue"
	`rgba(0, 158, 73, 0.1)`,     // "i0 green"
	`rgba(187, 194, 202, 0.1)`,  // "k0 grey"
	`rgba(255, 185, 0, 0.1)`,    // "b2 gold"
	`rgba(244, 114, 208, 0.1)`,  // "d2 pink"
	`rgba(70, 104, 197, 0.1)`,   // "f2 blue purple"
	`rgba(226, 229, 132, 0.1)`,  // "j2 khaki"
];

//constant strings
export const propertiesSearchDescription = localize('ep.propertiesSearchDescription', 'Search properties table');
export const topOperationsSearchDescription = localize('ep.topOperationsSearchDescription', 'Search top operations');
export const searchPlaceholder = localize('ep.searchPlaceholder', 'Filter for any field...');
