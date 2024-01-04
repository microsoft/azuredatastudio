"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github_1 = require("@actions/github");
const octokit_1 = require("../api/octokit");
const utils_1 = require("../utils/utils");
const token = (0, utils_1.getRequiredInput)('token');
const label = (0, utils_1.getRequiredInput)('label');
async function main() {
    const pr = new octokit_1.OctoKitIssue(token, github_1.context.repo, { number: github_1.context.issue.number });
    pr.addLabel(label);
}
main()
    .then(() => (0, utils_1.logRateLimit)(token))
    .catch(async (error) => {
    core.setFailed(error.message);
    await (0, utils_1.logErrorToIssue)(error.message, true, token);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztnR0FHZ0c7O0FBRWhHLHNDQUFxQztBQUNyQyw0Q0FBeUM7QUFDekMsNENBQTZDO0FBQzdDLDBDQUFnRjtBQUVoRixNQUFNLEtBQUssR0FBRyxJQUFBLHdCQUFnQixFQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3hDLE1BQU0sS0FBSyxHQUFHLElBQUEsd0JBQWdCLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFFeEMsS0FBSyxVQUFVLElBQUk7SUFFbEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxzQkFBWSxDQUFDLEtBQUssRUFBRSxnQkFBTyxDQUFDLElBQUksRUFBRSxFQUFFLE1BQU0sRUFBRSxnQkFBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBRW5GLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDcEIsQ0FBQztBQUVELElBQUksRUFBRTtLQUNKLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFBLG9CQUFZLEVBQUMsS0FBSyxDQUFDLENBQUM7S0FDL0IsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtJQUN0QixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUM3QixNQUFNLElBQUEsdUJBQWUsRUFBQyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUNsRCxDQUFDLENBQUMsQ0FBQSJ9