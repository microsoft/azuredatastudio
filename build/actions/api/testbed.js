"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestbedIssue = exports.Testbed = void 0;
class Testbed {
    constructor(config) {
        this.config = {
            globalLabels: config?.globalLabels ?? [],
            configs: config?.configs ?? {},
            writers: config?.writers ?? [],
            releasedCommits: config?.releasedCommits ?? [],
            queryRunner: config?.queryRunner ??
                async function* () {
                    yield [];
                },
        };
    }
    async *query(query) {
        for await (const page of this.config.queryRunner(query)) {
            yield page.map((issue) => issue instanceof TestbedIssue ? issue : new TestbedIssue(this.config, issue));
        }
    }
    async createIssue(_owner, _repo, _title, _body) {
        // pass...
    }
    async readConfig(path) {
        return JSON.parse(JSON.stringify(this.config.configs[path]));
    }
    async hasWriteAccess(user) {
        return this.config.writers.includes(user.name);
    }
    async repoHasLabel(label) {
        return this.config.globalLabels.includes(label);
    }
    async createLabel(label, _color, _description) {
        this.config.globalLabels.push(label);
    }
    async deleteLabel(labelToDelete) {
        this.config.globalLabels = this.config.globalLabels.filter((label) => label !== labelToDelete);
    }
    async releaseContainsCommit(_release, commit) {
        return this.config.releasedCommits.includes(commit);
    }
}
exports.Testbed = Testbed;
class TestbedIssue extends Testbed {
    constructor(globalConfig, issueConfig) {
        super(globalConfig);
        issueConfig = issueConfig ?? {};
        issueConfig.comments = issueConfig?.comments ?? [];
        issueConfig.labels = issueConfig?.labels ?? [];
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
        };
        this.issueConfig = issueConfig;
    }
    async addAssignee(assignee) {
        this.issueConfig.issue.assignee = assignee;
    }
    async setMilestone(milestoneId) {
        this.issueConfig.issue.milestoneId = milestoneId;
    }
    async getIssue() {
        const labels = [...this.issueConfig.labels];
        return { ...this.issueConfig.issue, labels };
    }
    async postComment(body, author) {
        this.issueConfig.comments.push({
            author: { name: author ?? 'bot' },
            body,
            id: Math.random(),
            timestamp: +new Date(),
        });
    }
    async deleteComment(id) {
        this.issueConfig.comments = this.issueConfig.comments.filter((comment) => comment.id !== id);
    }
    async *getComments(last) {
        yield last
            ? [this.issueConfig.comments[this.issueConfig.comments.length - 1]]
            : this.issueConfig.comments;
    }
    async addLabel(label) {
        this.issueConfig.labels.push(label);
    }
    async removeLabel(labelToDelete) {
        this.issueConfig.labels = this.issueConfig.labels.filter((label) => label !== labelToDelete);
    }
    async closeIssue() {
        this.issueConfig.issue.open = false;
    }
    async lockIssue() {
        this.issueConfig.issue.locked = true;
    }
    async getClosingInfo() {
        return this.issueConfig.closingCommit;
    }
}
exports.TestbedIssue = TestbedIssue;
