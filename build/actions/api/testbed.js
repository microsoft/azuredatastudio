"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestbedIssue = exports.Testbed = void 0;
class Testbed {
    config;
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
    issueConfig;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlc3RiZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOzs7QUFjaEcsTUFBYSxPQUFPO0lBQ1osTUFBTSxDQUFlO0lBRTVCLFlBQVksTUFBK0I7UUFDMUMsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNiLFlBQVksRUFBRSxNQUFNLEVBQUUsWUFBWSxJQUFJLEVBQUU7WUFDeEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLElBQUksRUFBRTtZQUM5QixPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sSUFBSSxFQUFFO1lBQzlCLGVBQWUsRUFBRSxNQUFNLEVBQUUsZUFBZSxJQUFJLEVBQUU7WUFDOUMsV0FBVyxFQUNWLE1BQU0sRUFBRSxXQUFXO2dCQUNuQixLQUFLLFNBQVMsQ0FBQztvQkFDZCxNQUFNLEVBQUUsQ0FBQTtnQkFDVCxDQUFDO1NBQ0YsQ0FBQTtJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBWTtRQUN4QixJQUFJLEtBQUssRUFBRSxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN4RCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUN4QixLQUFLLFlBQVksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQzVFLENBQUE7U0FDRDtJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQWMsRUFBRSxLQUFhLEVBQUUsTUFBYyxFQUFFLEtBQWE7UUFDN0UsVUFBVTtJQUNYLENBQUM7SUFFRCxLQUFLLENBQUMsVUFBVSxDQUFDLElBQVk7UUFDNUIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FB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