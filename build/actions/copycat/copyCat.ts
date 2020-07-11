/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubIssue } from '../api/api'

export class CopyCat {
	constructor(private github: GitHubIssue, private owner: string, private repo: string) {}

	async run() {
		const issue = await this.github.getIssue()
		console.log(`Mirroring issue \`${issue.title}\` to ${this.owner}/${this.repo}`)
		await this.github.createIssue(
			this.owner,
			this.repo,
			issue.title,
			issue.body.replace(/@|#|issues/g, '-'),
		)
	}
}
