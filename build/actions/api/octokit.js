"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.OctoKitIssue = exports.OctoKit = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const child_process_1 = require("child_process");
const utils_1 = require("../utils/utils");
class OctoKit {
    token;
    params;
    options;
    octokit;
    // when in readonly mode, record labels just-created so at to not throw unneccesary errors
    mockLabels = new Set();
    constructor(token, params, options = { readonly: false }) {
        this.token = token;
        this.params = params;
        this.options = options;
        this.octokit = new github_1.GitHub(token);
    }
    async *query(query) {
        const q = query.q + ` repo:${this.params.owner}/${this.params.repo}`;
        const options = this.octokit.search.issuesAndPullRequests.endpoint.merge({
            ...query,
            q,
            per_page: 100,
            headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
        });
        let pageNum = 0;
        const timeout = async () => {
            if (pageNum < 2) {
                /* pass */
            }
            else if (pageNum < 4) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
            else {
                await new Promise((resolve) => setTimeout(resolve, 30000));
            }
        };
        for await (const pageResponse of this.octokit.paginate.iterator(options)) {
            await timeout();
            await (0, utils_1.logRateLimit)(this.token);
            const page = pageResponse.data;
            yield page.map((issue) => new OctoKitIssue(this.token, this.params, this.octokitIssueToIssue(issue)));
        }
    }
    async createIssue(owner, repo, title, body) {
        (0, core_1.debug)(`Creating issue \`${title}\` on ${owner}/${repo}`);
        if (!this.options.readonly)
            await this.octokit.issues.create({ owner, repo, title, body });
    }
    octokitIssueToIssue(issue) {
        return {
            author: { name: issue.user.login, isGitHubApp: issue.user.type === 'Bot' },
            body: issue.body,
            number: issue.number,
            title: issue.title,
            labels: issue.labels.map((label) => label.name),
            open: issue.state === 'open',
            locked: issue.locked,
            numComments: issue.comments,
            reactions: issue.reactions,
            assignee: issue.assignee?.login ?? issue.assignees?.[0]?.login,
            milestoneId: issue.milestone?.number ?? null,
            createdAt: +new Date(issue.created_at),
            updatedAt: +new Date(issue.updated_at),
            closedAt: issue.closed_at ? +new Date(issue.closed_at) : undefined,
        };
    }
    writeAccessCache = {};
    async hasWriteAccess(user) {
        if (user.name in this.writeAccessCache) {
            (0, core_1.debug)('Got permissions from cache for ' + user);
            return this.writeAccessCache[user.name];
        }
        (0, core_1.debug)('Fetching permissions for ' + user);
        const permissions = (await this.octokit.repos.getCollaboratorPermissionLevel({
            ...this.params,
            username: user.name,
        })).data.permission;
        return (this.writeAccessCache[user.name] = permissions === 'admin' || permissions === 'write');
    }
    async repoHasLabel(name) {
        try {
            await this.octokit.issues.getLabel({ ...this.params, name });
            return true;
        }
        catch (err) {
            if (err.status === 404) {
                return this.options.readonly && this.mockLabels.has(name);
            }
            throw err;
        }
    }
    async createLabel(name, color, description) {
        (0, core_1.debug)('Creating label ' + name);
        if (!this.options.readonly)
            await this.octokit.issues.createLabel({ ...this.params, color, description, name });
        else
            this.mockLabels.add(name);
    }
    async deleteLabel(name) {
        (0, core_1.debug)('Deleting label ' + name);
        try {
            if (!this.options.readonly)
                await this.octokit.issues.deleteLabel({ ...this.params, name });
        }
        catch (err) {
            if (err.status === 404) {
                return;
            }
            throw err;
        }
    }
    async readConfig(path) {
        (0, core_1.debug)('Reading config at ' + path);
        const repoPath = `.github/${path}.json`;
        const data = (await this.octokit.repos.getContents({ ...this.params, path: repoPath })).data;
        if ('type' in data && data.type === 'file') {
            if (data.encoding === 'base64' && data.content) {
                return JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
            }
            throw Error(`Could not read contents "${data.content}" in encoding "${data.encoding}"`);
        }
        throw Error('Found directory at config path when expecting file' + JSON.stringify(data));
    }
    async releaseContainsCommit(release, commit) {
        if ((0, utils_1.getInput)('commitReleasedDebuggingOverride')) {
            return true;
        }
        return new Promise((resolve, reject) => (0, child_process_1.exec)(`git -C ./repo merge-base --is-ancestor ${commit} ${release}`, (err) => !err || err.code === 1 ? resolve(!err) : reject(err)));
    }
}
exports.OctoKit = OctoKit;
class OctoKitIssue extends OctoKit {
    params;
    issueData;
    constructor(token, params, issueData, options = { readonly: false }) {
        super(token, params, options);
        this.params = params;
        this.issueData = issueData;
    }
    async addAssignee(assignee) {
        (0, core_1.debug)('Adding assignee ' + assignee + ' to ' + this.issueData.number);
        if (!this.options.readonly) {
            await this.octokit.issues.addAssignees({
                ...this.params,
                issue_number: this.issueData.number,
                assignees: [assignee],
            });
        }
    }
    async closeIssue() {
        (0, core_1.debug)('Closing issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.issues.update({
                ...this.params,
                issue_number: this.issueData.number,
                state: 'closed',
            });
    }
    async lockIssue() {
        (0, core_1.debug)('Locking issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.issues.lock({ ...this.params, issue_number: this.issueData.number });
    }
    async getIssue() {
        if (isIssue(this.issueData)) {
            (0, core_1.debug)('Got issue data from query result ' + this.issueData.number);
            return this.issueData;
        }
        const issue = (await this.octokit.issues.get({
            ...this.params,
            issue_number: this.issueData.number,
            mediaType: { previews: ['squirrel-girl'] },
        })).data;
        return (this.issueData = this.octokitIssueToIssue(issue));
    }
    async postComment(body) {
        (0, core_1.debug)(`Posting comment ${body} on ${this.issueData.number}`);
        if (!this.options.readonly)
            await this.octokit.issues.createComment({
                ...this.params,
                issue_number: this.issueData.number,
                body,
            });
    }
    async deleteComment(id) {
        (0, core_1.debug)(`Deleting comment ${id} on ${this.issueData.number}`);
        if (!this.options.readonly)
            await this.octokit.issues.deleteComment({
                owner: this.params.owner,
                repo: this.params.repo,
                comment_id: id,
            });
    }
    async setMilestone(milestoneId) {
        (0, core_1.debug)(`Setting milestone for ${this.issueData.number} to ${milestoneId}`);
        if (!this.options.readonly)
            await this.octokit.issues.update({
                ...this.params,
                issue_number: this.issueData.number,
                milestone: milestoneId,
            });
    }
    async *getComments(last) {
        (0, core_1.debug)('Fetching comments for ' + this.issueData.number);
        const response = this.octokit.paginate.iterator(this.octokit.issues.listComments.endpoint.merge({
            ...this.params,
            issue_number: this.issueData.number,
            per_page: 100,
            ...(last ? { per_page: 1, page: (await this.getIssue()).numComments } : {}),
        }));
        for await (const page of response) {
            yield page.data.map((comment) => ({
                author: { name: comment.user.login, isGitHubApp: comment.user.type === 'Bot' },
                body: comment.body,
                id: comment.id,
                timestamp: +new Date(comment.created_at),
            }));
        }
    }
    async addLabel(name) {
        (0, core_1.debug)(`Adding label ${name} to ${this.issueData.number}`);
        if (!(await this.repoHasLabel(name))) {
            throw Error(`Action could not execute becuase label ${name} is not defined.`);
        }
        if (!this.options.readonly)
            await this.octokit.issues.addLabels({
                ...this.params,
                issue_number: this.issueData.number,
                labels: [name],
            });
    }
    async removeLabel(name) {
        (0, core_1.debug)(`Removing label ${name} from ${this.issueData.number}`);
        try {
            if (!this.options.readonly)
                await this.octokit.issues.removeLabel({
                    ...this.params,
                    issue_number: this.issueData.number,
                    name,
                });
        }
        catch (err) {
            if (err.status === 404) {
                return;
            }
            throw err;
        }
    }
    async getClosingInfo() {
        if ((await this.getIssue()).open) {
            return;
        }
        const options = this.octokit.issues.listEventsForTimeline.endpoint.merge({
            ...this.params,
            issue_number: this.issueData.number,
        });
        let closingCommit;
        for await (const event of this.octokit.paginate.iterator(options)) {
            const timelineEvents = event.data;
            for (const timelineEvent of timelineEvents) {
                if (timelineEvent.event === 'closed') {
                    closingCommit = {
                        hash: timelineEvent.commit_id ?? undefined,
                        timestamp: +new Date(timelineEvent.created_at),
                    };
                }
            }
        }
        return closingCommit;
    }
}
exports.OctoKitIssue = OctoKitIssue;
function isIssue(object) {
    const isIssue = 'author' in object &&
        'body' in object &&
        'title' in object &&
        'labels' in object &&
        'open' in object &&
        'locked' in object &&
        'number' in object &&
        'numComments' in object &&
        'reactions' in object &&
        'milestoneId' in object;
    return isIssue;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2N0b2tpdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9jdG9raXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOzs7QUFFaEcsd0NBQXFDO0FBQ3JDLDRDQUFxRDtBQUVyRCxpREFBb0M7QUFDcEMsMENBQXVEO0FBR3ZELE1BQWEsT0FBTztJQU1WO0lBQ0U7SUFDQTtJQVBELE9BQU8sQ0FBVztJQUM1QiwwRkFBMEY7SUFDaEYsVUFBVSxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFBO0lBRTdDLFlBQ1MsS0FBYSxFQUNYLE1BQXVDLEVBQ3ZDLFVBQWlDLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtRQUZ0RCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQ1gsV0FBTSxHQUFOLE1BQU0sQ0FBaUM7UUFDdkMsWUFBTyxHQUFQLE9BQU8sQ0FBNkM7UUFFOUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGVBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUNwQyxDQUFDO0lBRUQsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQVk7UUFDeEIsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxTQUFTLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUE7UUFFcEUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztZQUN4RSxHQUFHLEtBQUs7WUFDUixDQUFDO1lBQ0QsUUFBUSxFQUFFLEdBQUc7WUFDYixPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsbURBQW1ELEVBQUU7U0FDeEUsQ0FBQyxDQUFBO1FBRUYsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFBO1FBRWYsTUFBTSxPQUFPLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDMUIsSUFBSSxPQUFPLEdBQUcsQ0FBQyxFQUFF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