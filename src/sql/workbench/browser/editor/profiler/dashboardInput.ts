/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

export class DashboardInput extends EditorInput {

	private _uri?: string;
	public static ID: string = 'workbench.editorinputs.connectiondashboardinputs';
	public static SCHEMA: string = 'sqldashboard';

	private _initializedPromise: Thenable<void>;
	private _onConnectionChanged?: IDisposable;

	public get initializedPromise(): Thenable<void> {
		return this._initializedPromise;
	}

	private _uniqueSelector?: string;

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer?: HTMLElement;

	constructor(
		_connectionProfile: IConnectionProfile,
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@IModeService modeService: IModeService,
		@IModelService model: IModelService
	) {
		super();
		// TODO; possible refactor
		// basically this is mimicing creating a "model" (the backing model for text for editors)
		// for dashboard, even though there is no backing text. We need this so that we can
		// tell the icon theme services that we are a dashboard resource, therefore loading the correct icon

		// vscode has a comment that Mode's will eventually be removed (not sure the state of this comment)
		// so this might be able to be undone when that happens
		if (!model.getModel(this.resource)) {
			model.createModel('', modeService.create('dashboard'), this.resource);
		}
		this._initializedPromise = _connectionService.connectIfNotConnected(_connectionProfile, 'dashboard').then(
			u => {
				this._uri = u;
				const info = this._connectionService.getConnectionInfo(u);
				if (info) {
					this._onConnectionChanged = this._connectionService.onConnectionChanged(e => {
						if (e.connectionUri === u) {
							this._onDidChangeLabel.fire();
						}
					});
				}
			}
		);
	}

	public setUniqueSelector(uniqueSelector: string): void {
		this._uniqueSelector = uniqueSelector;
	}

	override get typeId(): string {
		return DashboardInput.ID;
	}

	public get resource(): URI {
		return URI.from({
			scheme: 'dashboard',
			path: 'dashboard'
		});
	}

	public override getName(): string {
		if (!this.connectionProfile) {
			return '';
		}

		let name = this.connectionProfile.connectionName ? this.connectionProfile.connectionName : this.connectionProfile.serverName;
		if (this.connectionProfile.databaseName
			&& !this.isMasterMssql()) {
			// Only add DB name if this is a non-default, non-master connection
			name = name + ':' + this.connectionProfile.databaseName;
		}
		return name;
	}

	private isMasterMssql(): boolean {
		return this.connectionProfile.providerName === mssqlProviderName
			&& this.connectionProfile.databaseName?.toLowerCase() === 'master';
	}

	public get uri(): string | undefined {
		return this._uri;
	}

	public override dispose(): void {
		this._disposeContainer();
		if (this._onConnectionChanged) {
			this._onConnectionChanged.dispose();
		}
		this._connectionService.disconnect(this._uri!);
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._parentContainer) {
			return;
		}

		const parentNode = this._parentContainer.parentNode;
		if (parentNode) {
			parentNode.removeChild(this._parentContainer);
		}
	}

	set container(container: HTMLElement | undefined) {
		this._disposeContainer();
		this._parentContainer = container;
	}

	get container(): HTMLElement | undefined {
		return this._parentContainer;
	}

	public supportsSplitEditor(): boolean {
		return false;
	}

	public get connectionProfile(): IConnectionProfile {
		return this._connectionService.getConnectionProfile(this._uri!);
	}

	public get hasInitialized(): boolean {
		return !!this._uniqueSelector;
	}

	public get uniqueSelector(): string | undefined {
		return this._uniqueSelector;
	}

	public override matches(otherinput: any): boolean {
		return otherinput instanceof DashboardInput
			&& DashboardInput.profileMatches(this.connectionProfile, otherinput.connectionProfile);
	}

	// similar to the default profile match but without databasename
	public static profileMatches(profile1: IConnectionProfile, profile2: IConnectionProfile): boolean {
		return profile1 && profile2
			&& profile1.providerName === profile2.providerName
			&& profile1.serverName === profile2.serverName
			&& profile1.userName === profile2.userName
			&& profile1.authenticationType === profile2.authenticationType
			&& profile1.groupFullName === profile2.groupFullName;
	}

	public get tabColor(): string {
		return this._connectionService.getTabColorForUri(this.uri!);
	}
}
