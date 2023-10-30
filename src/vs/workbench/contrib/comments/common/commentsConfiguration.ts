/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ICommentsConfiguration {
	openView: 'never' | 'file' | 'firstFile';
	useRelativeTime: boolean;
	visible: boolean;
	maxHeight: boolean;
}

export const COMMENTS_SECTION = 'comments';
