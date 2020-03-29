/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

(() => {
	const cp = require('child_process');

	cp.spawnSync('yarn rebuild sqlite3');
})();
