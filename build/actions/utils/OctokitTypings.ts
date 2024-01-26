/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { RestEndpointMethodTypes } from '@octokit/rest';

// This file is just to re-export some octokit types as nicer names

export type IssueGetResponse = RestEndpointMethodTypes['issues']['get']['response']['data'];
