/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Comment, GitHub, GitHubIssue, Issue, Query, User } from './api'

type TestbedConfig = {
	globalLabels: string[]
	configs: Record<string, any>
	writers: string[]
	releasedCommits: string[]
	queryRunner: (query: Query) => AsyncIterableIterator<(TestbedIssueConstructorArgs | TestbedIssue)[]>
}

export type TestbedConstructorArgs = Partial<TestbedConfig>

export class Testbed implements GitHub {
	public config: TestbedConfig

	constructor(config?: TestbedConstructorArgs) {
		this.config = {
			globalLabels: config?.globalLabels ?? [],
			configs: config?.configs ?? {},
			writers: config?.writers ?? [],
			releasedCommits: config?.releasedCommits ?? [],
			queryRunner:
				config?.queryRunner ??
				async function* () {
					yield []
				},
		}
	}

	async *query(query: Query): AsyncIterableIterator<GitHubIssue[]> {
		for await (const page of this.config.queryRunner(query)) {
			yield page.map((issue) =>
				issue instanceof TestbedIssue ? issue : new TestbedIssue(this.config, issue),
			)
		}
	}

	async createIssue(_owner: string, _repo: string, _title: string, _body: string): Promise<void> {
		// pass...
	}

	async readConfig(path: string): Promise<any> {
		return JSON.parse(JSON.stringify(this.config.configs[path]))
	}

	async hasWriteAccess(user: User): Promise<boolean> {
		return this.config.writers.includes(user.name)
	}

	async repoHasLabel(label: string): Promise<boolean> {
		return this.config.globalLabels.includes(label)
	}

	async createLabel(label: string, _color: string, _description: string): Promise<void> {
		this.config.globalLabels.push(label)
	}

	async deleteLabel(labelToDelete: string): Promise<void> {
		this.config.globalLabels = this.config.globalLabels.filter((label) => label !== labelToDelete)
	}

	async releaseContainsCommit(_release: string, commit: string): Promise<boolean> {
		return this.config.releasedCommits.includes(commit)
	}
}

type TestbedIssueConfig = {
	issue: Omit<Issue, 'labels'>
	comments: Comment[]
	labels: string[]
	closingCommit: { hash: string | undefined; timestamp: number } | undefined
}

export type TestbedIssueConstructorArgs = Partial<Omit<TestbedIssueConfig, 'issue'>> & {
	issue?: Partial<Omit<Issue, 'labels'>>
}

export class TestbedIssue extends Testbed implements GitHubIssue {
	public issueConfig: TestbedIssueConfig

	constructor(globalConfig?: TestbedConstructorArgs, issueConfig?: TestbedIssueConstructorArgs) {
		super(globalConfig)
		issueConfig = issueConfig ?? {}
		issueConfig.comments = issueConfig?.comments ?? []
		issueConfig.labels = issueConfig?.labels ?? []
		issueConfig.issue = {
			author: { name: 'JacksonKearl' },
			body: 'issue body',
			locked: false,
			numComments: issueConfig?.comments?.length || 0,
			number: 1,
			open: true,
			title: 'issue title',
			assignee: undefined,
			reactions: {
				'+1': 0,
				'-1': 0,
				confused: 0,
				eyes: 0,
				heart: 0,
				hooray: 0,
				laugh: 0,
				rocket: 0,
			},
			closedAt: undefined,
			createdAt: +new Date(),
			updatedAt: +new Date(),
			...issueConfig.issue,
		}

		this.issueConfig = issueConfig as TestbedIssueConfig
	}

	async addAssignee(assignee: string): Promise<void> {
		this.issueConfig.issue.assignee = assignee
	}

	async setMilestone(milestoneId: number): Promise<void> {
		this.issueConfig.issue.milestoneId = milestoneId
	}

	async getIssue(): Promise<Issue> {
		const labels = [...this.issueConfig.labels]
		return { ...this.issueConfig.issue, labels }
	}

	async postComment(body: string, author?: string): Promise<void> {
		this.issueConfig.comments.push({
			author: { name: author ?? 'bot' },
			body,
			id: Math.random(),
			timestamp: +new Date(),
		})
	}

	async deleteComment(id: number): Promise<void> {
		this.issueConfig.comments = this.issueConfig.comments.filter((comment) => comment.id !== id)
	}

	async *getComments(last?: boolean): AsyncIterableIterator<Comment[]> {
		yield last
			? [this.issueConfig.comments[this.issueConfig.comments.length - 1]]
			: this.issueConfig.comments
	}

	async addLabel(label: string): Promise<void> {
		this.issueConfig.labels.push(label)
	}

	async removeLabel(labelToDelete: string): Promise<void> {
		this.issueConfig.labels = this.issueConfig.labels.filter((label) => label !== labelToDelete)
	}

	async closeIssue(): Promise<void> {
		this.issueConfig.issue.open = false
	}

	async lockIssue(): Promise<void> {
		this.issueConfig.issue.locked = true
	}

	async getClosingInfo(): Promise<{ hash: string | undefined; timestamp: number } | undefined> {
		return this.issueConfig.closingCommit
	}
}
