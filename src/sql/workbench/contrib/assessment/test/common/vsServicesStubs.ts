/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEnvironmentService, IExtensionHostDebugParams } from 'vs/platform/environment/common/environment';
import { URI } from 'vs/base/common/uri';
import * as files from 'vs/platform/files/common/files';
import { IDisposable } from 'vs/base/common/lifecycle';
import { VSBuffer, VSBufferReadable, VSBufferReadableStream } from 'vs/base/common/buffer';
import { Event } from 'vs/base/common/event';
import { IDialogService, IConfirmation, IDialogOptions, IConfirmationResult, IShowResult } from 'vs/platform/dialogs/common/dialogs';
import Severity from 'vs/base/common/severity';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import {
	INotificationService,
	INotification,
	INotificationHandle,
	IPromptOptions,
	IStatusMessageOptions,
	NotificationsFilter,
	NotificationMessage,
	IPromptChoice
} from 'vs/platform/notification/common/notification';


export class EnvironmentServiceStub implements IEnvironmentService {
	_serviceBrand: undefined;
	userRoamingDataHome: URI;
	settingsResource: URI;
	keybindingsResource: URI;
	keyboardLayoutResource: URI;
	argvResource: URI;
	snippetsHome: URI;
	backupHome: URI;
	untitledWorkspacesHome: URI;
	globalStorageHome: URI;
	workspaceStorageHome: URI;
	userDataSyncLogResource: URI;
	userDataSyncHome: URI;
	sync: 'on' | 'off';
	enableSyncByDefault: boolean;
	debugExtensionHost: IExtensionHostDebugParams;
	isExtensionDevelopment: boolean;
	disableExtensions: boolean | string[];
	extensionDevelopmentLocationURI?: URI[];
	extensionTestsLocationURI?: URI;
	extensionEnabledProposedApi?: string[];
	logExtensionHostCommunication?: boolean;
	logsPath: string;
	logLevel?: string;
	verbose: boolean;
	isBuilt: boolean;
	disableTelemetry: boolean;
	serviceMachineIdResource: URI;

}

export class FileServiceStub implements files.IFileService {
	_serviceBrand: undefined;
	onDidChangeFileSystemProviderRegistrations: Event<files.IFileSystemProviderRegistrationEvent>;
	onDidChangeFileSystemProviderCapabilities: Event<files.IFileSystemProviderCapabilitiesChangeEvent>;
	onWillActivateFileSystemProvider: Event<files.IFileSystemProviderActivationEvent>;
	onDidFilesChange: Event<files.FileChangesEvent>;
	onDidRunOperation: Event<files.FileOperationEvent>;

	registerProvider(scheme: string, provider: files.IFileSystemProvider): IDisposable {
		return null;
	}
	activateProvider(scheme: string): Promise<void> {
		return null;
	}
	canHandleResource(resource: URI): boolean {
		return true;
	}
	hasCapability(resource: URI, capability: files.FileSystemProviderCapabilities): boolean {
		return true;
	}


	resolve(resource: URI, options: files.IResolveMetadataFileOptions): Promise<files.IFileStatWithMetadata>;
	resolve(resource: URI, options?: files.IResolveFileOptions): Promise<files.IFileStat> {
		throw new Error('Method not implemented.');
	}

	resolveAll(toResolve: { resource: URI, options: files.IResolveMetadataFileOptions }[]): Promise<files.IResolveFileResult[]>;
	resolveAll(toResolve: { resource: URI, options?: files.IResolveFileOptions }[]): Promise<files.IResolveFileResult[]> {
		throw new Error('Method not implemented.');
	}
	exists(resource: URI): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	readFile(resource: URI, options?: files.IReadFileOptions): Promise<files.IFileContent> {
		throw new Error('Method not implemented.');
	}
	readFileStream(resource: URI, options?: files.IReadFileOptions): Promise<files.IFileStreamContent> {
		throw new Error('Method not implemented.');
	}
	writeFile(resource: URI, bufferOrReadableOrStream: VSBuffer | VSBufferReadable | VSBufferReadableStream, options?: files.IWriteFileOptions): Promise<files.IFileStatWithMetadata> {
		throw new Error('Method not implemented.');
	}
	move(source: URI, target: URI, overwrite?: boolean): Promise<files.IFileStatWithMetadata> {
		throw new Error('Method not implemented.');
	}
	async canMove(source: URI, target: URI, overwrite?: boolean | undefined): Promise<Error | true> { return true; }
	copy(source: URI, target: URI, overwrite?: boolean): Promise<files.IFileStatWithMetadata> {
		throw new Error('Method not implemented.');
	}
	async canCopy(source: URI, target: URI, overwrite?: boolean | undefined): Promise<Error | true> { return true; }
	async canCreateFile(source: URI, options?: files.ICreateFileOptions): Promise<Error | true> { return true; }
	createFile(resource: URI, bufferOrReadableOrStream?: VSBuffer | VSBufferReadable | VSBufferReadableStream, options?: files.ICreateFileOptions): Promise<files.IFileStatWithMetadata> {
		return Promise.resolve({
			ctime: 0,
			etag: '',
			isDirectory: false,
			isFile: false,
			isSymbolicLink: false,
			mtime: 0,
			name: '',
			resource: resource,
			size: 0
		});
	}
	createFolder(resource: URI): Promise<files.IFileStatWithMetadata> {
		throw new Error('Method not implemented.');
	}
	del(_resource: URI, _options?: { useTrash?: boolean, recursive?: boolean }): Promise<void> { return Promise.resolve(); }
	canDelete(resource: URI, options?: { useTrash?: boolean | undefined; recursive?: boolean | undefined; } | undefined): Promise<Error | true> {
		return Promise.resolve(true);
	}
	readonly watches: URI[] = [];
	watch(_resource: URI): IDisposable {
		this.watches.push(_resource);

		return null;
	}
	dispose(): void { }

}

export class DialogServiceStub implements IDialogService {
	_serviceBrand: undefined;
	confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
		throw new Error('Method not implemented.');
	}
	show(severity: Severity, message: string, buttons: string[], options?: IDialogOptions): Promise<IShowResult> {
		throw new Error('Method not implemented.');
	}
	about(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}

export class ClipboardServiceStub implements IClipboardService {
	_serviceBrand: undefined;
	writeText(text: string, type?: string): Promise<void> {
		return Promise.resolve();
	}
	readText(type?: string): Promise<string> {
		return Promise.resolve('');
	}
	readFindText(): Promise<string> {
		return Promise.resolve('');
	}
	writeFindText(text: string): Promise<void> {
		return Promise.resolve();
	}
	writeResources(resources: URI[]): Promise<void> {
		return Promise.resolve();
	}
	readResources(): Promise<URI[]> {
		return Promise.resolve(null);
	}
	hasResources(): Promise<boolean> {
		return Promise.resolve(true);
	}
}

export class NotificationServiceStub implements INotificationService {
	_serviceBrand: undefined;
	notify(notification: INotification): INotificationHandle {
		throw new Error('Method not implemented.');
	}
	info(message: string | Error | NotificationMessage[]): void {
		throw new Error('Method not implemented.');
	}
	warn(message: string | Error | NotificationMessage[]): void {
		throw new Error('Method not implemented.');
	}
	error(message: string | Error | NotificationMessage[]): void {
		throw new Error('Method not implemented.');
	}
	prompt(severity: Severity, message: string, choices: IPromptChoice[], options?: IPromptOptions): INotificationHandle {
		throw new Error('Method not implemented.');
	}
	status(message: NotificationMessage, options?: IStatusMessageOptions): IDisposable {
		throw new Error('Method not implemented.');
	}
	setFilter(filter: NotificationsFilter): void {
		throw new Error('Method not implemented.');
	}

}


