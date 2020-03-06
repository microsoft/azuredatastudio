/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Toolkit } from 'actions-toolkit';
import { Octokit } from '@octokit/rest';

interface LabelDefinition {
	id: number,
	name: string
}

interface RepoContext {
	repo: string,
	owner: string
}

const tools = new Toolkit({
	event: 'issue_comment',
	secrets: ['GITHUB_TOKEN']
});

const labelToCheckFor = tools.inputs.label || 'Approved';

const fileToCheckFor = tools.inputs.filePath || './.github/mergers.json';

const checkMerged = async (repoContext: RepoContext, pullNumber: number): Promise<boolean> => {
	let isMerged: boolean;
	try {
		const result = await tools.github.pulls.checkIfMerged({
			...repoContext,
			pull_number: pullNumber
		});
		isMerged = result.status === 204;
	} catch (ex) {
		isMerged = false;
	}
	return isMerged;
};

const checkCollabrator = async (repoContext: RepoContext, username: string): Promise<boolean> => {
	let isCollabrator: boolean;
	try {
		const result = await tools.github.repos.checkCollaborator({
			...repoContext,
			username,
		});
		isCollabrator = result.status === 204;
	} catch (ex) {
		isCollabrator = false;
	}
	return isCollabrator;
};

tools.command('merge', async () => {
	try {
		const issue = tools.context.payload.issue;

		if (issue?.pull_request === undefined) {
			console.log('This command only works on pull requests');
			return;
		}

		const sender = tools.context.payload.sender;

		const senderName = sender?.login ?? ' Unknown Sender';
		const issueNumber = issue?.number;

		if (!issueNumber) {
			return tools.log.error('Issue number not defined.');
		}

		const isMerged = await checkMerged(tools.context.repo, issueNumber);

		if (isMerged === true) {
			console.log('PR is already merged');
			return;
		}

		const mergers: string[] = JSON.parse(tools.getFile(fileToCheckFor));

		if (!mergers.includes(senderName)) {
			console.log('Unrecognized user tried to merge!', senderName);
			return;
		}

		const isCollabrator = await checkCollabrator(tools.context.repo, senderName);

		if (isCollabrator !== true) {
			console.log('User is not a collabrator');
			return;
		}

		const labels: LabelDefinition[] = issue.labels || [];

		const foundLabel = labels.find(l => l.name === labelToCheckFor);

		if (foundLabel === undefined) {
			console.log(`Label ${labelToCheckFor} must be applied`);
			const createCommentParams: Octokit.IssuesCreateCommentParams = {
				...tools.context.repo,
				issue_number: issueNumber,
				body: `The label ${labelToCheckFor} is required for using this command.`
			};
			await tools.github.issues.createComment(createCommentParams);
			return;
		}

		const createCommentParams: Octokit.IssuesCreateCommentParams = {
			...tools.context.repo,
			issue_number: issueNumber,
			body: `Merging PR based on approval from @${senderName}`
		};

		const commentResult = await tools.github.issues.createComment(createCommentParams);

		if (commentResult.status !== 201) {
			console.log('Comment not created');
			return;
		}

		const mergeResult = await tools.github.pulls.merge({
			...tools.context.repo,
			pull_number: issueNumber,
			merge_method: 'squash'
		});
		console.log(mergeResult);
	} catch (ex) {
		console.error(ex);
	}
});

console.log('Running...');
