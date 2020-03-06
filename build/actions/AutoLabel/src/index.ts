/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Toolkit } from 'actions-toolkit';

const tools = new Toolkit({
	event: 'pull_request',
	secrets: ['GITHUB_TOKEN']
});

const label = tools.inputs.label || 'Port Request';

async function run() {
	try {
		let prNumber = tools.context.payload?.pull_request?.number;

		if (prNumber === undefined) {
			console.error('PR Number was undefined');
			tools.log.error('PR Number was undefined');
			return;
		}

		tools.github.issues.addLabels({
			...tools.context.repo,
			labels: [label],
			issue_number: prNumber
		});

	} catch (ex) {
		console.error(ex);
		tools.log.error(ex);
	}
}

run();
