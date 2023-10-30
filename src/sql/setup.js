/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	require.__$__nodeRequire('gridstack/dist/h5/gridstack-dd-native');
	require.__$__nodeRequire('html-to-image/dist/html-to-image.js');
	require.__$__nodeRequire('reflect-metadata');
	require.__$__nodeRequire('chart.js');
	// VS Code uses an AMD loader for its own files (and ours) but Node.JS normally uses commonjs. For modules that
	// support UMD this may cause some issues since it will appear to them that AMD exists and so depending on the order
	// they check support for the two types they may end up using either commonjs or AMD. If commonjs is first this is
	// the expected method and so nothing needs to be done - but if it's AMD then the VS Code loader will throw an error
	// (Can only have one anonymous define call per script file) since it only expects to be loading its own files.

	// In order to make packages like zone.js load correctly we need to temporarily set AMD to false so that the modules
	// load using commonjs before continuing.
	const amd = define.amd;
	define.amd = false;
	require.__$__nodeRequire('zone.js/dist/zone');
	require.__$__nodeRequire('zone.js/dist/zone-error');
	define.amd = amd;

	window['Zone']['__zone_symbol__ignoreConsoleErrorUncaughtError'] = true;
	window['Zone']['__zone_symbol__unhandledPromiseRejectionHandler'] = e => setImmediate(() => {
		window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', e));
	}); // let window handle this

});
