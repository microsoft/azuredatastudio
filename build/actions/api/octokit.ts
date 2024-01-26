/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { debug } from '@actions/core';
import { getOctokit } from '@actions/github';
import type { RequestError } from '@octokit/request-error';
import { exec } from 'child_process';
import { getInput, logRateLimit } from '../utils/utils';
import { Comment, GitHub, GitHubIssue, Issue, Query, User } from './api';
import { IssueGetResponse } from '../utils/OctokitTypings';

export class OctoKit implements GitHub {
	private _octokit: ReturnType<typeof getOctokit>;
	protected get octokit(): ReturnType<typeof getOctokit> {
		return this._octokit;
	}

	// when in readonly mode, record labels just-created so at to not throw unneccesary errors
	protected mockLabels: Set<string> = new Set()

	constructor(
		private token: string,
		protected params: { repo: string; owner: string },
		protected options: { readonly: boolean } = { readonly: false },
	) {
		this._octokit = getOctokit(token);
	}

	async *query(query: Query): AsyncIterableIterator<GitHubIssue[]> {
		const q = query.q + ` repo:${this.params.owner}/${this.params.repo}`

		const options = {
			...query,
			q,
			per_page: 100,
			headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
		};

		let pageNum = 0

		const timeout = async () => {
			if (pageNum < 2) {
				/* pass */
			} else if (pageNum < 4) {
				await new Promise((resolve) => setTimeout(resolve, 3000))
			} else {
				await new Promise((resolve) => setTimeout(resolve, 30000))
			}
		}

		for await (const pageResponse of this.octokit.paginate.iterator(
			this.octokit.rest.search.issuesAndPullRequests,
			options,
		)) {
			await timeout()
			await logRateLimit(this.token)
			const page = pageResponse.data;
			yield page.map(
				(issue) => new OctoKitIssue(this.token, this.params, this.octokitIssueToIssue(issue)),
			)
		}
	}

	async createIssue(owner: string, repo: string, title: string, body: string): Promise<void> {
		debug(`Creating issue \`${title}\` on ${owner}/${repo}`)
		if (!this.options.readonly) await this.octokit.rest.issues.create({ owner, repo, title, body })
	}

	protected octokitIssueToIssue(issue: IssueGetResponse): Issue {
		return {
			author: { name: issue.user?.login ?? 'unkown', isGitHubApp: issue.user?.type === 'Bot' },
			body: issue.body ?? '',
			number: issue.number,
			title: issue.title,
			labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name ?? '')),
			open: issue.state === 'open',
			locked: (issue as any).locked,
			numComments: issue.comments,
			reactions: (issue as any).reactions,
			assignee: issue.assignee?.login ?? (issue as IssueGetResponse).assignees?.[0]?.login,
			milestoneId: issue.milestone?.number ?? null,
			createdAt: +new Date(issue.created_at),
			updatedAt: +new Date(issue.updated_at),
			closedAt: issue.closed_at ? +new Date((issue.closed_at as unknown) as string) : undefined,
		}
	}

	private writeAccessCache: Record<string, boolean> = {}
	async hasWriteAccess(user: User): Promise<boolean> {
		if (user.name in this.writeAccessCache) {
			debug('Got permissions from cache for ' + user)
			return this.writeAccessCache[user.name]
		}
		debug('Fetching permissions for ' + user)
		const permissions = (
			await this.octokit.rest.repos.getCollaboratorPermissionLevel({
				...this.params,
				username: user.name,
			})
		).data.permission
		return (this.writeAccessCache[user.name] = permissions === 'admin' || permissions === 'write')
	}

	async repoHasLabel(name: string): Promise<boolean> {
		try {
			await this.octokit.rest.issues.getLabel({ ...this.params, name })
			return true
		} catch (err) {
			const statusErorr = err as RequestError;
			if (statusErorr.status === 404) {
				return this.options.readonly && this.mockLabels.has(name)
			}
			throw err
		}
	}

	async createLabel(name: string, color: string, description: string): Promise<void> {
		debug('Creating label ' + name)
		if (!this.options.readonly)
			await this.octokit.rest.issues.createLabel({ ...this.params, color, description, name })
		else this.mockLabels.add(name)
	}

	async deleteLabel(name: string): Promise<void> {
		debug('Deleting label ' + name)
		try {
			if (!this.options.readonly) await this.octokit.rest.issues.deleteLabel({ ...this.params, name })
		} catch (err) {
			const statusErorr = err as RequestError;
			if (statusErorr.status === 404) {
				return
			}
			throw err
		}
	}

	async readConfig(path: string): Promise<any> {
		debug('Reading config at ' + path)
		const repoPath = `.github/${path}.json`
		const data = (await this.octokit.rest.repos.getContent({ ...this.params, path: repoPath })).data;
		if ('type' in data && data.type === 'file' && 'content' in data) {
			if (data.encoding === 'base64' && data.content) {
				return JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
			}
			throw Error(`Could not read contents "${data.content}" in encoding "${data.encoding}"`)
		}
		throw Error('Found directory at config path when expecting file' + JSON.stringify(data))
	}

	async releaseContainsCommit(release: string, commit: string): Promise<boolean> {
		if (getInput('commitReleasedDebuggingOverride')) {
			return true
		}
		return new Promise((resolve, reject) =>
			exec(`git -C ./repo merge-base --is-ancestor ${commit} ${release}`, (err) =>
				!err || err.code === 1 ? resolve(!err) : reject(err),
			),
		)
	}
}

export class OctoKitIssue extends OctoKit implements GitHubIssue {
	constructor(
		token: string,
		protected params: { repo: string; owner: string },
		private issueData: { number: number } | Issue,
		options: { readonly: boolean } = { readonly: false },
	) {
		super(token, params, options)
	}

	async addAssignee(assignee: string): Promise<void> {
		debug('Adding assignee ' + assignee + ' to ' + this.issueData.number)
		if (!this.options.readonly) {
			await this.octokit.rest.issues.addAssignees({
				...this.params,
				issue_number: this.issueData.number,
				assignees: [assignee],
			})
		}
	}

	async closeIssue(): Promise<void> {
		debug('Closing issue ' + this.issueData.number)
		if (!this.options.readonly)
			await this.octokit.rest.issues.update({
				...this.params,
				issue_number: this.issueData.number,
				state: 'closed',
			})
	}

	async lockIssue(): Promise<void> {
		debug('Locking issue ' + this.issueData.number)
		if (!this.options.readonly)
			await this.octokit.rest.issues.lock({ ...this.params, issue_number: this.issueData.number })
	}

	async getIssue(): Promise<Issue> {
		if (isIssue(this.issueData)) {
			debug('Got issue data from query result ' + this.issueData.number)
			return this.issueData
		}

		const issue = (
			await this.octokit.rest.issues.get({
				...this.params,
				issue_number: this.issueData.number,
				mediaType: { previews: ['squirrel-girl'] },
			})
		).data
		return (this.issueData = this.octokitIssueToIssue(issue))
	}

	async postComment(body: string): Promise<void> {
		debug(`Posting comment ${body} on ${this.issueData.number}`)
		if (!this.options.readonly)
			await this.octokit.rest.issues.createComment({
				...this.params,
				issue_number: this.issueData.number,
				body,
			})
	}

	async deleteComment(id: number): Promise<void> {
		debug(`Deleting comment ${id} on ${this.issueData.number}`)
		if (!this.options.readonly)
			await this.octokit.rest.issues.deleteComment({
				owner: this.params.owner,
				repo: this.params.repo,
				comment_id: id,
			})
	}

	async setMilestone(milestoneId: number) {
		debug(`Setting milestone for ${this.issueData.number} to ${milestoneId}`)
		if (!this.options.readonly)
			await this.octokit.rest.issues.update({
				...this.params,
				issue_number: this.issueData.number,
				milestone: milestoneId,
			})
	}

	async *getComments(last?: boolean): AsyncIterableIterator<Comment[]> {
		debug('Fetching comments for ' + this.issueData.number)

		const response = this.octokit.paginate.iterator(this.octokit.rest.issues.listComments, {
			...this.params,
			issue_number: this.issueData.number,
			per_page: 100,
			...(last ? { per_page: 1, page: (await this.getIssue()).numComments } : {}),
		});

		for await (const page of response) {
			yield page.data.map((comment) => ({
				author: { name: comment.user?.login ?? '', isGitHubApp: comment.user?.type === 'Bot' },
				body: comment.body ?? '',
				id: comment.id,
				timestamp: +new Date(comment.created_at),
			}))
		}
	}

	async addLabel(name: string): Promise<void> {
		debug(`Adding label ${name} to ${this.issueData.number}`)
		if (!(await this.repoHasLabel(name))) {
			throw Error(`Action could not execute becuase label ${name} is not defined.`)
		}
		if (!this.options.readonly)
			await this.octokit.rest.issues.addLabels({
				...this.params,
				issue_number: this.issueData.number,
				labels: [name],
			})
	}

	async removeLabel(name: string): Promise<void> {
		debug(`Removing label ${name} from ${this.issueData.number}`)
		try {
			if (!this.options.readonly)
				await this.octokit.rest.issues.removeLabel({
					...this.params,
					issue_number: this.issueData.number,
					name,
				})
		} catch (err) {
			const statusErorr = err as RequestError;
			if (statusErorr.status === 404) {
				return
			}
			throw err
		}
	}

	async getClosingInfo(): Promise<{ hash: string | undefined; timestamp: number } | undefined> {
		if ((await this.getIssue()).open) {
			return
		}

		const options = {
			...this.params,
			issue_number: this.issueData.number,
		};
		let closingCommit: { hash: string | undefined; timestamp: number } | undefined
		for await (const event of this.octokit.paginate.iterator(
			this.octokit.rest.issues.listEventsForTimeline,
			options,
		)) {
			const timelineEvents = event.data;
			for (const timelineEvent of timelineEvents) {
				if (timelineEvent.event === 'closed' && timelineEvent.created_at) {
					closingCommit = {
						hash: timelineEvent.commit_id ?? undefined,
						timestamp: +new Date(timelineEvent.created_at),
					}
				}
			}
		}
		return closingCommit
	}
}

function isIssue(object: any): object is Issue {
	const isIssue =
		'author' in object &&
		'body' in object &&
		'title' in object &&
		'labels' in object &&
		'open' in object &&
		'locked' in object &&
		'number' in object &&
		'numComments' in object &&
		'reactions' in object &&
		'milestoneId' in object

	return isIssue
}
