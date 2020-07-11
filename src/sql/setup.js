/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(['require', 'exports'], function (require) {
	const jquerylib = require.__$__nodeRequire('jquery');

	window['jQuery'] = jquerylib;
	window['$'] = jquerylib;

	require.__$__nodeRequire('slickgrid/lib/jquery.event.drag-2.3.0');
	require.__$__nodeRequire('slickgrid/lib/jquery-ui-1.9.2');
	require.__$__nodeRequire('slickgrid/slick.core');
	require.__$__nodeRequire('slickgrid/slick.grid');
	require.__$__nodeRequire('slickgrid/slick.editors');
	require.__$__nodeRequire('slickgrid/slick.dataview');
	require.__$__nodeRequire('slickgrid/plugins/slick.cellrangedecorator');
	require.__$__nodeRequire('reflect-metadata');
	require.__$__nodeRequire('zone.js');
	require.__$__nodeRequire('zone.js/dist/zone-error');
	require.__$__nodeRequire('chart.js');
	window['Zone']['__zone_symbol__ignoreConsoleErrorUncaughtError'] = true;
	window['Zone']['__zone_symbol__unhandledPromiseRejectionHandler'] = e => setImmediate(() => {
		window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', e));
	}); // let window handle this
});
