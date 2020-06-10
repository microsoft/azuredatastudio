"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../utils/utils");
const token = utils_1.getRequiredInput('token');
const label = utils_1.getRequiredInput('label');
async function main() {
    const pr = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number });
    pr.addLabel(label);
}
main()
    .then(() => utils_1.logRateLimit(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await utils_1.logErrorToIssue(error.message, true, token);
});
