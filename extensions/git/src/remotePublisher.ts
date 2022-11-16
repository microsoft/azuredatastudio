/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, Event } from 'vscode';
import { RemoteSourcePublisher } from './api/git';

export interface IRemoteSourcePublisherRegistry {
	readonly onDidAddRemoteSourcePublisher: Event<RemoteSourcePublisher>;
	readonly onDidRemoveRemoteSourcePublisher: Event<RemoteSourcePublisher>;

	getRemoteSourcePublishers(): RemoteSourcePublisher[];
	registerRemoteSourcePublisher(publisher: RemoteSourcePublisher): Disposable;
}
