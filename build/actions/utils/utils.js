"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.logErrorToIssue = exports.logRateLimit = exports.daysAgoToHumanReadbleDate = exports.daysAgoToTimestamp = exports.loadLatestRelease = exports.normalizeIssue = exports.getRequiredInput = exports.getInput = void 0;
const core = require("@actions/core");
const github_1 = require("@actions/github");
const axios_1 = require("axios");
const octokit_1 = require("../api/octokit");
const getInput = (name) => core.getInput(name) || undefined;
exports.getInput = getInput;
const getRequiredInput = (name) => core.getInput(name, { required: true });
exports.getRequiredInput = getRequiredInput;
const normalizeIssue = (issue) => {
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
exports.normalizeIssue = normalizeIssue;
const loadLatestRelease = async (quality) => (await axios_1.default.get(`https://vscode-update.azurewebsites.net/api/update/darwin/${quality}/latest`)).data;
exports.loadLatestRelease = loadLatestRelease;
const daysAgoToTimestamp = (days) => +new Date(Date.now() - days * 24 * 60 * 60 * 1000);
exports.daysAgoToTimestamp = daysAgoToTimestamp;
const daysAgoToHumanReadbleDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}\w$/, '');
exports.daysAgoToHumanReadbleDate = daysAgoToHumanReadbleDate;
const logRateLimit = async (token) => {
    const usageData = (await (0, github_1.getOctokit)(token).rest.rateLimit.get()).data.resources;
    const usage = {};
    ['core', 'graphql', 'search'].forEach(async (category) => {
        if (usageData[category]) {
            usage[category] = 1 - (usageData[category]?.remaining ?? 0) / (usageData[category]?.limit ?? 1);
        }
        const message = `Usage at ${usage[category]} for ${category}`;
        if (usage[category] > 0.5) {
            await (0, exports.logErrorToIssue)(message, false, token);
        }
    });
};
exports.logRateLimit = logRateLimit;
const logErrorToIssue = async (message, ping, token) => {
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
exports.logErrorToIssue = logErrorToIssue;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztnR0FHZ0c7OztBQUVoRyxzQ0FBcUM7QUFDckMsNENBQXFEO0FBQ3JELGlDQUF5QjtBQUN6Qiw0Q0FBNkM7QUFHdEMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksU0FBUyxDQUFBO0FBQTdELFFBQUEsUUFBUSxZQUFxRDtBQUNuRSxNQUFNLGdCQUFnQixHQUFHLENBQUMsSUFBWSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO0FBQTVFLFFBQUEsZ0JBQWdCLG9CQUE0RDtBQUVsRixNQUFNLGNBQWMsR0FBRyxDQUM3QixLQUFZLEVBQ3dFLEVBQUU7SUFDdEYsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUE7SUFFN0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNyRixNQUFNLGdCQUFnQixHQUNyQixJQUFJLENBQUMsUUFBUSxDQUFDLDBCQUEwQixDQUFDLElBQUksZ0NBQWdDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBRXpGLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBVyxFQUFFLEVBQUUsQ0FDL0IsR0FBRztTQUNELFdBQVcsRUFBRTtTQUNiLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDO1NBQzNCLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7U0FDL0IsT0FBTyxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQztTQUMvQixPQUFPLENBQUMsZ0NBQWdD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