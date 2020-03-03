/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const core = require('@actions/core');
const github = require('@actions/github');

function getPrNumber() {
	return github.context.payload.pull_request.number;
}

async function run() {
	try {
		const token = core.getInput('token', { required: true });
		const label = core.getInput('label', { required: true });

		const client = new github.GitHub(token);
		const prNumber = getPrNumber();

		client.issues.addLabels({
			labels: [label],
			owner: github.context.repo.owner,
			repo: github.context.repo.repo,
			issue_number: prNumber
		})

	} catch (ex) {
		console.error(ex);
		core.setFailed(ex);
		core.error(ex);
	}
}

run();
