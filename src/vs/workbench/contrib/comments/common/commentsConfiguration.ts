/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ICommentsConfiguration {
	openView: 'never' | 'file' | 'firstFile';
	useRelativeTime: boolean;
}

export const COMMENTS_SECTION = 'comments';
