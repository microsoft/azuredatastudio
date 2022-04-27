/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const winOrCtrl = process.platform === 'darwin' ? 'ctrl' : 'win';
export const ctrlOrCmd = process.platform === 'darwin' ? 'cmd' : 'ctrl';