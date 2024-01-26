"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
    _octokit;
    get octokit() {
        return this._octokit;
    }
    // when in readonly mode, record labels just-created so at to not throw unneccesary errors
    mockLabels = new Set();
    constructor(token, params, options = { readonly: false }) {
        this.token = token;
        this.params = params;
        this.options = options;
        this._octokit = (0, github_1.getOctokit)(token);
    }
    async *query(query) {
        const q = query.q + ` repo:${this.params.owner}/${this.params.repo}`;
        const options = {
            ...query,
            q,
            per_page: 100,
            headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
        };
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
        for await (const pageResponse of this.octokit.paginate.iterator(this.octokit.rest.search.issuesAndPullRequests, options)) {
            await timeout();
            await (0, utils_1.logRateLimit)(this.token);
            const page = pageResponse.data;
            yield page.map((issue) => new OctoKitIssue(this.token, this.params, this.octokitIssueToIssue(issue)));
        }
    }
    async createIssue(owner, repo, title, body) {
        (0, core_1.debug)(`Creating issue \`${title}\` on ${owner}/${repo}`);
        if (!this.options.readonly)
            await this.octokit.rest.issues.create({ owner, repo, title, body });
    }
    octokitIssueToIssue(issue) {
        return {
            author: { name: issue.user?.login ?? 'unkown', isGitHubApp: issue.user?.type === 'Bot' },
            body: issue.body ?? '',
            number: issue.number,
            title: issue.title,
            labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name ?? '')),
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
        const permissions = (await this.octokit.rest.repos.getCollaboratorPermissionLevel({
            ...this.params,
            username: user.name,
        })).data.permission;
        return (this.writeAccessCache[user.name] = permissions === 'admin' || permissions === 'write');
    }
    async repoHasLabel(name) {
        try {
            await this.octokit.rest.issues.getLabel({ ...this.params, name });
            return true;
        }
        catch (err) {
            const statusErorr = err;
            if (statusErorr.status === 404) {
                return this.options.readonly && this.mockLabels.has(name);
            }
            throw err;
        }
    }
    async createLabel(name, color, description) {
        (0, core_1.debug)('Creating label ' + name);
        if (!this.options.readonly)
            await this.octokit.rest.issues.createLabel({ ...this.params, color, description, name });
        else
            this.mockLabels.add(name);
    }
    async deleteLabel(name) {
        (0, core_1.debug)('Deleting label ' + name);
        try {
            if (!this.options.readonly)
                await this.octokit.rest.issues.deleteLabel({ ...this.params, name });
        }
        catch (err) {
            const statusErorr = err;
            if (statusErorr.status === 404) {
                return;
            }
            throw err;
        }
    }
    async readConfig(path) {
        (0, core_1.debug)('Reading config at ' + path);
        const repoPath = `.github/${path}.json`;
        const data = (await this.octokit.rest.repos.getContent({ ...this.params, path: repoPath })).data;
        if ('type' in data && data.type === 'file' && 'content' in data) {
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
            await this.octokit.rest.issues.addAssignees({
                ...this.params,
                issue_number: this.issueData.number,
                assignees: [assignee],
            });
        }
    }
    async closeIssue() {
        (0, core_1.debug)('Closing issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.rest.issues.update({
                ...this.params,
                issue_number: this.issueData.number,
                state: 'closed',
            });
    }
    async lockIssue() {
        (0, core_1.debug)('Locking issue ' + this.issueData.number);
        if (!this.options.readonly)
            await this.octokit.rest.issues.lock({ ...this.params, issue_number: this.issueData.number });
    }
    async getIssue() {
        if (isIssue(this.issueData)) {
            (0, core_1.debug)('Got issue data from query result ' + this.issueData.number);
            return this.issueData;
        }
        const issue = (await this.octokit.rest.issues.get({
            ...this.params,
            issue_number: this.issueData.number,
            mediaType: { previews: ['squirrel-girl'] },
        })).data;
        return (this.issueData = this.octokitIssueToIssue(issue));
    }
    async postComment(body) {
        (0, core_1.debug)(`Posting comment ${body} on ${this.issueData.number}`);
        if (!this.options.readonly)
            await this.octokit.rest.issues.createComment({
                ...this.params,
                issue_number: this.issueData.number,
                body,
            });
    }
    async deleteComment(id) {
        (0, core_1.debug)(`Deleting comment ${id} on ${this.issueData.number}`);
        if (!this.options.readonly)
            await this.octokit.rest.issues.deleteComment({
                owner: this.params.owner,
                repo: this.params.repo,
                comment_id: id,
            });
    }
    async setMilestone(milestoneId) {
        (0, core_1.debug)(`Setting milestone for ${this.issueData.number} to ${milestoneId}`);
        if (!this.options.readonly)
            await this.octokit.rest.issues.update({
                ...this.params,
                issue_number: this.issueData.number,
                milestone: milestoneId,
            });
    }
    async *getComments(last) {
        (0, core_1.debug)('Fetching comments for ' + this.issueData.number);
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
            }));
        }
    }
    async addLabel(name) {
        (0, core_1.debug)(`Adding label ${name} to ${this.issueData.number}`);
        if (!(await this.repoHasLabel(name))) {
            throw Error(`Action could not execute becuase label ${name} is not defined.`);
        }
        if (!this.options.readonly)
            await this.octokit.rest.issues.addLabels({
                ...this.params,
                issue_number: this.issueData.number,
                labels: [name],
            });
    }
    async removeLabel(name) {
        (0, core_1.debug)(`Removing label ${name} from ${this.issueData.number}`);
        try {
            if (!this.options.readonly)
                await this.octokit.rest.issues.removeLabel({
                    ...this.params,
                    issue_number: this.issueData.number,
                    name,
                });
        }
        catch (err) {
            const statusErorr = err;
            if (statusErorr.status === 404) {
                return;
            }
            throw err;
        }
    }
    async getClosingInfo() {
        if ((await this.getIssue()).open) {
            return;
        }
        const options = {
            ...this.params,
            issue_number: this.issueData.number,
        };
        let closingCommit;
        for await (const event of this.octokit.paginate.iterator(this.octokit.rest.issues.listEventsForTimeline, options)) {
            const timelineEvents = event.data;
            for (const timelineEvent of timelineEvents) {
                if (timelineEvent.event === 'closed' && timelineEvent.created_at) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2N0b2tpdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9jdG9raXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOzs7QUFFaEcsd0NBQXNDO0FBQ3RDLDRDQUE2QztBQUU3QyxpREFBcUM7QUFDckMsMENBQXdEO0FBSXhELE1BQWEsT0FBTztJQVVWO0lBQ0U7SUFDQTtJQVhILFFBQVEsQ0FBZ0M7SUFDaEQsSUFBYyxPQUFPO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0lBRUQsMEZBQTBGO0lBQ2hGLFVBQVUsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQTtJQUU3QyxZQUNTLEtBQWEsRUFDWCxNQUF1QyxFQUN2QyxVQUFpQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7UUFGdEQsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUNYLFdBQU0sR0FBTixNQUFNLENBQWlDO1FBQ3ZDLFlBQU8sR0FBUCxPQUFPLENBQTZDO1FBRTlELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBQSxtQkFBVSxFQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRCxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBWTtRQUN4QixNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLFNBQVMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQTtRQUVwRSxNQUFNLE9BQU8sR0FBRztZQUNmLEdBQUcsS0FBSztZQUNSLENBQUM7WUFDRCxRQUFRLEVBQUUsR0FBRztZQUNiLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxtREFBbUQsRUFBRTtTQUN4RSxDQUFDO1FBRUYsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFBO1FBRWYsTUFBTSxPQUFPLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDMUIsSUFBSSxPQUFPLEdBQUcsQ0FBQyxFQUFFO2dCQUNoQixV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