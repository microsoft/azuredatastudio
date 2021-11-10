/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerEditPath, DesignerRootObjectPath } from 'sql/workbench/browser/designer/interfaces';

/**
 * Join the path segments to form a path.
 */
export function joinPath(...parts: (string | number)[]): DesignerEditPath {
	return parts.filter(s => s !== '').join('/');
}

/**
 * Split the path into segments.
 */
export function splitPath(path: DesignerEditPath = DesignerRootObjectPath): string[] {
	return path.split('/').filter(s => s !== '');
}
