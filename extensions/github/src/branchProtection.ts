/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { authentication, EventEmitter, LogOutputChannel, Memento, Uri, workspace } from 'vscode';
import { Repository as GitHubRepository, RepositoryRuleset } from '@octokit/graphql-schema';
import { AuthenticationError, getOctokitGraphql } from './auth';
import { API, BranchProtection, BranchProtectionProvider, BranchProtectionRule, Repository } from './typings/git';
import { DisposableStore, getRepositoryFromUrl } from './util';

const REPOSITORY_QUERY = `
	query repositoryPermissions($owner: String!, $repo: String!) {
		repository(owner: $owner, name: $repo) {
			defaultBranchRef {
				name
			},
			viewerPermission
		}
	}
`;

const REPOSITORY_RULESETS_QUERY = `
	query repositoryRulesets($owner: String!, $repo: String!, $cursor: String, $limit: Int = 100) {
		repository(owner: $owner, name: $repo) {
			rulesets(includeParents: true, first: $limit, after: $cursor) {
				nodes {
					name
					enforcement
					rules(type: PULL_REQUEST) {
						totalCount
					}
					conditions {
						refName {
							include
							exclude
						}
					}
					target
				},
				pageInfo {
					endCursor,
					hasNextPage
				}
			}
		}
	}
`;

export class GithubBranchProtectionProviderManager {

	private readonly disposables = new DisposableStore();
	private readonly providerDisposables = new DisposableStore();

	private _enabled = false;
	private set enabled(enabled: boolean) {
		if (this._enabled === enabled) {
			return;
		}

		if (enabled) {
			for (const repository of this.gitAPI.repositories) {
				this.providerDisposables.add(this.gitAPI.registerBranchProtectionProvider(repository.rootUri, new GithubBranchProtectionProvider(repository, this.globalState, this.logger)));
			}
		} else {
			this.providerDisposables.dispose();
		}

		this._enabled = enabled;
	}

	constructor(
		private readonly gitAPI: API,
		private readonly globalState: Memento,
		private readonly logger: LogOutputChannel) {
		this.disposables.add(this.gitAPI.onDidOpenRepository(repository => {
			if (this._enabled) {
				this.providerDisposables.add(gitAPI.registerBranchProtectionProvider(repository.rootUri, new GithubBranchProtectionProvider(repository, this.globalState, this.logger)));
			}
		}));

		this.disposables.add(workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('github.branchProtection')) {
				this.updateEnablement();
			}
		}));

		this.updateEnablement();
	}

	private updateEnablement(): void {
		const config = workspace.getConfiguration('github', null);
		this.enabled = config.get<boolean>('branchProtection', true) === true;
	}

	dispose(): void {
		this.enabled = false;
		this.disposables.dispose();
	}

}

export class GithubBranchProtectionProvider implements BranchProtectionProvider {
	private readonly _onDidChangeBranchProtection = new EventEmitter<Uri>();
	onDidChangeBranchProtection = this._onDidChangeBranchProtection.event;

	private branchProtection: BranchProtection[];
	private readonly globalStateKey = `branchProtection:${this.repository.rootUri.toString()}`;

	constructor(
		private readonly repository: Repository,
		private readonly globalState: Memento,
		private readonly logger: LogOutputChannel) {
		// Restore branch protection from global state
		this.branchProtection = this.globalState.get<BranchProtection[]>(this.globalStateKey, []);

		repository.status().then(() => {
			authentication.onDidChangeSessions(e => {
				if (e.provider.id === 'github') {
					this.updateRepositoryBranchProtection(true);
				}
			});
			this.updateRepositoryBranchProtection();
		});
	}

	provideBranchProtection(): BranchProtection[] {
		return this.branchProtection;
	}

	private async getRepositoryDetails(owner: string, repo: string, silent: boolean): Promise<GitHubRepository> {
		const graphql = await getOctokitGraphql(silent);
		const { repository } = await graphql<{ repository: GitHubRepository }>(REPOSITORY_QUERY, { owner, repo });

		return repository;
	}

	private async getRepositoryRulesets(owner: string, repo: string, silent: boolean): Promise<RepositoryRuleset[]> {
		const rulesets: RepositoryRuleset[] = [];

		let cursor: string | undefined = undefined;
		const graphql = await getOctokitGraphql(silent);

		while (true) {
			const { repository } = await graphql<{ repository: GitHubRepository }>(REPOSITORY_RULESETS_QUERY, { owner, repo, cursor });

			rulesets.push(...(repository.rulesets?.nodes ?? [])
				// Active branch ruleset that contains the pull request required rule
				.filter(node => node && node.target === 'BRANCH' && node.enforcement === 'ACTIVE' && (node.rules?.totalCount ?? 0) > 0) as RepositoryRuleset[]);

			if (repository.rulesets?.pageInfo.hasNextPage) {
				cursor = repository.rulesets.pageInfo.endCursor as string | undefined;
			} else {
				break;
			}
		}

		return rulesets;
	}

	private async updateRepositoryBranchProtection(silent = false): Promise<void> {
		const branchProtection: BranchProtection[] = [];

		try {
			for (const remote of this.repository.state.remotes) {
				const repository = getRepositoryFromUrl(remote.pushUrl ?? remote.fetchUrl ?? '');

				if (!repository) {
					continue;
				}

				// Repository details
				this.logger.trace(`Fetching repository details for "${repository.owner}/${repository.repo}".`);
				const repositoryDetails = await this.getRepositoryDetails(repository.owner, repository.repo, silent);

				// Check repository write permission
				if (repositoryDetails.viewerPermission !== 'ADMIN' && repositoryDetails.viewerPermission !== 'MAINTAIN' && repositoryDetails.viewerPermission !== 'WRITE') {
					this.logger.trace(`Skipping branch protection for "${repository.owner}/${repository.repo}" due to missing repository write permission.`);
					continue;
				}

				// Get repository rulesets
				const branchProtectionRules: BranchProtectionRule[] = [];
				const repositoryRulesets = await this.getRepositoryRulesets(repository.owner, repository.repo, silent);

				for (const ruleset of repositoryRulesets) {
					branchProtectionRules.push({
						include: (ruleset.conditions.refName?.include ?? []).map(r => this.parseRulesetRefName(repositoryDetails, r)),
						exclude: (ruleset.conditions.refName?.exclude ?? []).map(r => this.parseRulesetRefName(repositoryDetails, r))
					});
				}

				branchProtection.push({ remote: remote.name, rules: branchProtectionRules });
			}

			this.branchProtection = branchProtection;
			this._onDidChangeBranchProtection.fire(this.repository.rootUri);

			// Save branch protection to global state
			await this.globalState.update(this.globalStateKey, branchProtection);
			this.logger.trace(`Branch protection for "${this.repository.rootUri.toString()}": ${JSON.stringify(branchProtection)}.`);
		} catch (err) {
			this.logger.warn(`Failed to update repository branch protection: ${err.message}`);

			if (err instanceof AuthenticationError) {
				// A GitHub authentication session could be missing if the user has not yet
				// signed in with their GitHub account or they have signed out. In this case
				// we have to clear the branch protection information.
				this.branchProtection = branchProtection;
				this._onDidChangeBranchProtection.fire(this.repository.rootUri);

				await this.globalState.update(this.globalStateKey, undefined);
			}
		}
	}

	private parseRulesetRefName(repository: GitHubRepository, refName: string): string {
		if (refName.startsWith('refs/heads/')) {
			return refName.substring(11);
		}

		switch (refName) {
			case '~ALL':
				return '**/*';
			case '~DEFAULT_BRANCH':
				return repository.defaultBranchRef!.name;
			default:
				return refName;
		}
	}
}
