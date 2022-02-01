/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

const { createModuleDescription, createEditorWorkerModuleDescription } = require('../base/buildfile');

exports.collectModules = function () {
	return [
		createEditorWorkerModuleDescription('vs/workbench/contrib/output/common/outputLinkComputer'),

		createModuleDescription('vs/workbench/contrib/debug/node/telemetryApp'),

		createModuleDescription('vs/workbench/services/search/node/searchApp'),

		createModuleDescription('vs/platform/files/node/watcher/unix/watcherApp'),
		createModuleDescription('vs/platform/files/node/watcher/nsfw/watcherApp'),

		createModuleDescription('vs/platform/terminal/node/ptyHostMain'),

		createModuleDescription('vs/workbench/services/extensions/node/extensionHostProcess'),
	];
};
