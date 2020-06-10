"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const axios_1 = require("axios");
const octokit_1 = require("../api/octokit");
exports.getInput = (name) => core.getInput(name) || undefined;
exports.getRequiredInput = (name) => core.getInput(name, { required: true });
exports.normalizeIssue = (issue) => {
    const { body, title } = issue;
    const isBug = body.includes('bug_report_template') || /Issue Type:.*Bug.*/.test(body);
    const isFeatureRequest = body.includes('feature_request_template') || /Issue Type:.*Feature Request.*/.test(body);
    const cleanse = (str) => str
        .toLowerCase()
        .replace(/<!--.*?-->/gu, '')
        .replace(/.* version: .*/gu, '')
        .replace(/issue type: .*/gu, '')
        .replace(/<details>(.|\s)*?<\/details>/gu, '')
        .replace(/vs ?code/gu, '')
        .replace(/we have written.*please paste./gu, '')
        .replace(/steps to reproduce:/gu, '')
        .replace(/does this issue occur when all extensions are disabled.*/gu, '')
        .replace(/```(.|\s)*?```/gu, '')
        .replace(/!?\[.*?\]\(.*?\)/gu, '')
        .replace(/\s+/gu, ' ');
    return {
        body: cleanse(body),
        title: cleanse(title),
        issueType: isBug ? 'bug' : isFeatureRequest ? 'feature_request' : 'unknown',
    };
};
exports.loadLatestRelease = async (quality) => (await axios_1.default.get(`https://vscode-update.azurewebsites.net/api/update/darwin/${quality}/latest`)).data;
exports.daysAgoToTimestamp = (days) => +new Date(Date.now() - days * 24 * 60 * 60 * 1000);
exports.daysAgoToHumanReadbleDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}\w$/, '');
exports.logRateLimit = async (token) => {
    const usageData = (await new github_1.GitHub(token).rateLimit.get()).data.resources;
    ['core', 'graphql', 'search'].forEach(async (category) => {
        const usage = 1 - usageData[category].remaining / usageData[category].limit;
        const message = `Usage at ${usage} for ${category}`;
        if (usage > 0) {
            console.log(message);
        }
        if (usage > 0.5) {
            await exports.logErrorToIssue(message, false, token);
        }
    });
};
exports.logErrorToIssue = async (message, ping, token) => {
    // Attempt to wait out abuse detection timeout if present
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const dest = github_1.context.repo.repo === 'vscode-internalbacklog'
        ? { repo: 'vscode-internalbacklog', issue: 974 }
        : { repo: 'vscode', issue: 93814 };
    return new octokit_1.OctoKitIssue(token, { owner: 'Microsoft', repo: dest.repo }, { number: dest.issue })
        .postComment(`
Workflow: ${github_1.context.workflow}

Error: ${message}

Issue: ${ping ? `${github_1.context.repo.owner}/${github_1.context.repo.repo}#` : ''}${github_1.context.issue.number}

Repo: ${github_1.context.repo.owner}/${github_1.context.repo.repo}

<!-- Context:
${JSON.stringify(github_1.context, null, 2).replace(/<!--/gu, '<@--').replace(/-->/gu, '--@>')}
-->
`);
};
