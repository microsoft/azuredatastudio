// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as nls from 'vscode-nls';

/**
 * The function to call to localize a string.
 * This is a one-time initialization call for vscode localization framework.
 * All other modules should import ./localization instead.
 */
export const localize = nls.config(JSON.parse(process.env.VSCODE_NLS_CONFIG || '{}') as nls.Options)();
