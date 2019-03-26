/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';

export interface IPackageInfo {
    name: string;
    version: string;
    aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
    if (packageJson) {
        return {
            name: packageJson.name,
            version: packageJson.version,
            aiKey: packageJson.aiKey
        };
    }
}

/**
 * Get the configuration for a extensionName
 * @param extensionName The string name of the extension to get the configuration for
 * @param resource The optional URI, as a URI object or a string, to use to get resource-scoped configurations
 */
export function getConfiguration(extensionName?: string, resource?: vscode.Uri | string): vscode.WorkspaceConfiguration {
    if (typeof resource === 'string') {
        try {
            resource = this.parseUri(resource);
        } catch (e) {
            resource = undefined;
        }
    } else if (!resource) {
        // Fix to avoid adding lots of errors to debug console. Expects a valid resource or null, not undefined
        resource = null;
    }
    return vscode.workspace.getConfiguration(extensionName, resource as vscode.Uri);
}
