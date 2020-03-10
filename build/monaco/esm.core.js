/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Entry file for webpack bunlding.

import * as monaco from 'monaco-editor-core';

self.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		return './editor.worker.bundle.js';
	}
};

monaco.editor.create(document.getElementById('container'), {
	value: [
		'var hello = "hello world";'
	].join('\n'),
	language: 'javascript'
});
