/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command, ToolType, OsType } from '../../interfaces';
import * as nls from 'vscode-nls';
import { SemVer } from 'semver';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();

export class KubeCtlTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return 'kubectl';
	}

	get description(): string {
		return localize('resourceDeployment.KubeCtlDescription', 'A command-line tool allows you to run commands against Kubernetes clusters');
	}

	get type(): ToolType {
		return ToolType.KubeCtl;
	}

	get displayName(): string {
		return localize('resourceDeployment.KubeCtlDisplayName', 'kubectl');
	}

	get homePage(): string {
		return 'https://kubernetes.io/docs/tasks/tools/install-kubectl';
	}

	protected getVersionFromOutput(output: string): SemVer | undefined {
		let version: SemVer | undefined = undefined;
		if (output) {
			const versionJson = JSON.parse(output);
			version = new SemVer(`${versionJson.clientVersion.major}.${versionJson.clientVersion.minor}.0`);
		}
		return version;
	}

	protected get versionCommand(): Command {
		return { command: 'kubectl version -o json --client' };
	}

	get autoInstallSupported(): boolean {
		return true;
	}
	get installationCommands(): Command[] {
		switch (this.osType) {
			case OsType.darwin: return [
				{
					comment: `updating your brew repository ...`,
					command: 'brew update'
				},
				{
					comment: `installing ${this.name} ...`,
					command: 'brew install kubectl'
				}
			];
			case OsType.linux: return [
				{
					sudo: true,
					comment: 'updating repository information ...',
					command: 'apt-get update'
				},
				{
					sudo: true,
					comment: 'getting packages needed for installation ...',
					command: 'apt-get install -y apt-transport-https'
				},
				{
					sudo: true,
					comment: 'downloading and installing the signing key ...',
					command: 'curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -'
				},
				{
					sudo: true,
					comment: `adding the ${this.name} repository information ...`,
					command: 'echo "deb https://apt.kubernetes.io/ kubernetes-xenial main" | tee -a /etc/apt/sources.list.d/kubernetes.list'
				},
				{
					sudo: true,
					comment: 'updating repository information ...',
					command: 'apt-get update'
				},
				{
					sudo: true,
					comment: `installing ${this.name} ...`,
					command: 'apt-get install -y kubectl'
				}
			];
			// TODO: Remove dependency on curl on Win32 and use powershell Invoke-WebRequest instead
			case OsType.win32: return [
				{
					comment: 'deleting previously downloaded kubectl.exe if one exists ...',
					command: `IF EXIST .\kubectl.exe DEL /F .\kubectl.exe`,
				},
				{
					comment: `downloading and installing the latest kubectl.exe ...`,
					command: `for /f %i in ('curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt') do curl -LO https://storage.googleapis.com/kubernetes-release/release/%i/bin/windows/amd64/kubectl.exe`
				}
			];
			default: // all other platforms
				return [
					{
						comment: `deleting previously downloaded ${this.name} if one exists ...`,
						command: `[ -e ./kubectl ] && rm -f ./kubectl`,
					},
					{
						comment: `downloading the latest ${this.name} release ...`,
						command: 'curl -LO https://storage.googleapis.com/kubernetes-release/release/`curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt`/bin/linux/amd64/kubectl'
					},
					{
						comment: `making kubectl executable ...`,
						command: 'chmod +x ./kubectl',
					},
					{
						sudo: true,
						comment: `cleaning up any previously backed up version in the install location if they exist ...`,
						command: `[ -e /usr/local/bin/kubectl] && [ -e /usr/local/bin/kubectl.${this.fullVersion}_movedByADS ] && rm -f /usr/local/bin/kubectl.${this.fullVersion}_movedByADS`
					},
					{
						sudo: true,
						comment: `backing up any existing kubectl in the install location ...`,
						command: `[ -e /usr/local/bin/kubectl ] && mv /usr/local/bin/kubectl /usr/local/bin/kubectl.${this.fullVersion}_movedByADS`
					},
					{
						comment: `moving kubectl into the install location in the PATH ...`,
						sudo: true,
						command: 'mv ./kubectl /usr/local/bin/kubectl'
					}
				];
		}
	}
}
