/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService, IWorkspaceTrustTransitionParticipant, IWorkspaceTrustUriInfo, WorkspaceTrustRequestOptions, WorkspaceTrustUriResponse } from 'vs/platform/workspace/common/workspaceTrust';


export class TestWorkspaceTrustManagementService implements IWorkspaceTrustManagementService {
	_serviceBrand: undefined;

	private _onDidChangeTrust = new Emitter<boolean>();
	onDidChangeTrust = this._onDidChangeTrust.event;

	private _onDidChangeTrustedFolders = new Emitter<void>();
	onDidChangeTrustedFolders = this._onDidChangeTrustedFolders.event;

	private _onDidInitiateWorkspaceTrustRequestOnStartup = new Emitter<void>();
	onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;


	constructor(
		private enabled: boolean = true,
		private trusted: boolean = true) {
	}

	get acceptsOutOfWorkspaceFiles(): boolean {
		throw new Error('Method not implemented.');
	}

	set acceptsOutOfWorkspaceFiles(value: boolean) {
		throw new Error('Method not implemented.');
	}

	addWorkspaceTrustTransitionParticipant(participant: IWorkspaceTrustTransitionParticipant): IDisposable {
		throw new Error('Method not implemented.');
	}

	getTrustedUris(): URI[] {
		throw new Error('Method not implemented.');
	}

	setParentFolderTrust(trusted: boolean): Promise<void> {
		throw new Error('Method not implemented.');
	}

	getUriTrustInfo(uri: URI): Promise<IWorkspaceTrustUriInfo> {
		throw new Error('Method not implemented.');
	}

	async setTrustedUris(folders: URI[]): Promise<void> {
		throw new Error('Method not implemented.');
	}

	async setUrisTrust(uris: URI[], trusted: boolean): Promise<void> {
		throw new Error('Method not implemented.');
	}

	canSetParentFolderTrust(): boolean {
		throw new Error('Method not implemented.');
	}

	canSetWorkspaceTrust(): boolean {
		throw new Error('Method not implemented.');
	}

	isWorkpaceTrusted(): boolean {
		return this.trusted;
	}

	isWorkspaceTrustForced(): boolean {
		return false;
	}

	get workspaceTrustEnabled(): boolean {
		return this.enabled;
	}

	get workspaceTrustInitialized(): Promise<void> {
		return Promise.resolve();
	}

	get workspaceResolved(): Promise<void> {
		return Promise.resolve();
	}

	async setWorkspaceTrust(trusted: boolean): Promise<void> {
		if (this.trusted !== trusted) {
			this.trusted = trusted;
			this._onDidChangeTrust.fire(this.trusted);
		}
	}
}

export class TestWorkspaceTrustRequestService implements IWorkspaceTrustRequestService {
	_serviceBrand: any;

	private readonly _onDidInitiateWorkspaceTrustRequest = new Emitter<WorkspaceTrustRequestOptions>();
	readonly onDidInitiateWorkspaceTrustRequest = this._onDidInitiateWorkspaceTrustRequest.event;

	private readonly _onDidCompleteWorkspaceTrustRequest = new Emitter<boolean>();
	readonly onDidCompleteWorkspaceTrustRequest = this._onDidCompleteWorkspaceTrustRequest.event;

	constructor(private readonly _trusted: boolean) { }

	requestOpenUrisHandler = async (uris: URI[]) => {
		return WorkspaceTrustUriResponse.Open;
	};

	requestOpenUris(uris: URI[]): Promise<WorkspaceTrustUriResponse> {
		return this.requestOpenUrisHandler(uris);
	}

	cancelRequest(): void {
		throw new Error('Method not implemented.');
	}

	async completeRequest(trusted?: boolean): Promise<void> {
		throw new Error('Method not implemented.');
	}

	async requestWorkspaceTrust(options?: WorkspaceTrustRequestOptions): Promise<boolean> {
		return this._trusted;
	}
}
