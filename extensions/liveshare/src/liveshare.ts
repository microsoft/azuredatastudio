/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Entrypoint and type definitions for Live Share for VS Code extension API
 */

import * as vscode from 'vscode';

/**
 * Forward definition of the ContactServiceProvider interface
 */
interface ContactServiceProvider {

}

/**
 * Main API that enables other VS Code extensions to access Live Share capabilities.
 */
export interface LiveShare {
	/**
	 * Status of participation in a sharing session, if any.
	 * Also includes the Live Share user info, if signed in.
	 */
	readonly session: Session;

	/**
	 * Event that notifies listeners when participation in a sharing session
	 * starts or stops.
	 */
	readonly onDidChangeSession: vscode.Event<SessionChangeEvent>;

	/** List of peers connected to the current sharing session, NOT including oneself. */
	readonly peers: Peer[];

	/** Event that notifies listeners when peers join or leave the session. */
	readonly onDidChangePeers: vscode.Event<PeersChangeEvent>;

	/**
	 * Starts a new session, sharing the currenly opened workspace.
	 * Or if sharing was already started, retrieves the join link.
	 *
	 * Not valid when joined to a session as a guest.
	 *
	 * @returns Join link for the new or existing session, or `null` if sharing failed.
	 */
	share(options?: ShareOptions): Promise<vscode.Uri | null>;

	/**
	 * Joins a shared session using a link acquired from the host.
	 *
	 * Note joining another session requires either reloading the current window
	 * (and all extensions) or opening a new window.
	 *
	 * @param link Join link for a shared session.
	 */
	join(link: vscode.Uri, options?: JoinOptions): Promise<void>;

	/**
	 * When called as a Host, ends the current sharing session and disconnects all guests,
	 * (without reloading the window or extensions).
	 *
	 * When called as a Guest, disconnects from the current sharing session
	 * and closes the workspace (causing extensions to be reloaded).
	 */
	end(): Promise<void>;

	/**
	 * Provides a named service to guests. The service is made available only
	 * while a Live Share session is active in the Host role.
	 *
	 * The caller must add request and/or notification handlers to the returned
	 * `SharedService` instance in order to receive messages from guests.
	 *
	 * A `SharedService` instance is returned even if the service is not
	 * currently made available because there is no hosted sharing session.
	 * The service will be automatically made available when a hosted sharing
	 * session begins.
	 *
	 * NOTE: Access to shared services may be restricted.
	 * If the caller is not permitted, this method returns `null`.
	 */
	shareService(name: string): Promise<SharedService | null>;

	/**
	 * Stops providing a named service to guests.
	 *
	 * NOTE: Access to shared services may be restricted.
	 */
	unshareService(name: string): Promise<void>;

	/**
	 * Gets a proxy for a named service provided by a Host. The service is
	 * available only while a Live Share session is active in the Guest role
	 * AND the session Host has shared the named service.
	 *
	 * The caller must add a notification handler to the returned `SharedService`
	 * instance in order to receive notifications from hosts. (Service proxies
	 * cannot receive requests, only send them.)
	 *
	 * A `SharedServiceProxy` instance is returned even if the service is not
	 * currently available (either because there is no active sharing session or
	 * because the Host has not shared the service). Listen to the event on the
	 * instance to be notified when the service becomes available or unavailable.
	 *
	 * NOTE: Access to shared services may be restricted.
	 * If the caller is not permitted, this method returns `null`.
	 */
	getSharedService(name: string): Promise<SharedServiceProxy | null>;

	/**
	 * Converts a local `file:` URI to a `vsls:` URI. Only available in host role.
	 */
	convertLocalUriToShared(localUri: vscode.Uri): vscode.Uri;

	/**
	 * Converts a `vsls:` URI to a local `file:` URI. Only available in host role.
	 */
	convertSharedUriToLocal(sharedUri: vscode.Uri): vscode.Uri;

	/**
	 * Registers a command to be added to the Live Share contextual command palette.
	 *
	 * @param command command identifier, as declared in the calling extension's manifest
	 * @param isEnabled optional callback to check if the command is available
	 * @param thisArg optional `this` for the callback
	 * @returns Disposable that can be used to unregister the command, or null if the command
	 * could not be registered.
	 *
	 * The command must be declared in the `contributes.commands` section of the calling
	 * extension manifest, including extended VSLS label and detail properties, for example:
	 *     "contributes": {
	 *         "commands": [
	 *             {
	 *                 "command": "myextension.mycommand",
	 *                 "title": "Live Share: Do Something",
	 *                 "vsls-label": "$(star) Do Something",
	 *                 "vsls-detail": "Do some VSLS-related command provided by this extension"
	 *             }
	 *         ]
	 *     }
	 *
	 * Extensions should use this capability judiciously, to avoid cluttering the Live Share
	 * command palette. If contributing a group of related commands, put them in a separate
	 * quick-pick menu that is brought up by a single command registered here.
	 *
	 * NOTE: Ability to contribute commands to the Live Share command palette may be restricted.
	 * If the caller is not permitted, this method returns `null`.
	 */
	registerCommand(
		command: string,
		isEnabled?: () => boolean,
		thisArg?: any): vscode.Disposable | null;

	/**
	 * Registers a provider that can extend a Live Share tree view by providing additional items.
	 *
	 * @param viewId One of the Live Share tree view IDs. Not all Live Share tree views support
	 * data providers; currently only the session and session explorer views do.
	 * @param treeDataProvider A provider that provides additional data for the Live Share view.
	 * @returns Disposable that can be used to unregister the provider, or null if the provider
	 * could not be registered.
	 *
	 * NOTE: Ability to contribute commands to Live Share tree views may be restricted. If the
	 * caller is not permitted, this method returns `null`.
	 */
	registerTreeDataProvider<T>(
		viewId: View,
		treeDataProvider: vscode.TreeDataProvider<T>,
	): vscode.Disposable | null;

	/**
	 * Registers a contact service provider.
	 *
	 * @param name Name of the provider ('skype', 'teams',..)
	 * @param contactServiceProvider implementation of the ContactServiceProvider interface
	 * @returns Disposable that can be used to unregister the provider, or null if the provider
	 * could not be registered.
	 */
	registerContactServiceProvider(
		name: string,
		contactServiceProvider: ContactServiceProvider,
	): vscode.Disposable | null;

	/**
	 * Sends a request to share a local server in the active collaboration session.
	 *
	 * @param server Contains properties pertaining to the local server.
	 * @returns A registration object that will un-share the server when disposed.
	 */
	shareServer(server: Server): Promise<vscode.Disposable>;

	/**
	 * Request contacts to our presence providers
	 * @param emails Request contacts emails
	 */
	getContacts(emails: string[]): Promise<ContactsCollection>;
}

interface ShareOptions {
	/**
	 * Suppress display of the usual notification that indicates that sharing
	 * started. Also suppresses copying the join link to the clipboard. When
	 * setting this option, the caller should take care of showing or
	 * communicating the link somehow.
	 */
	suppressNotification?: boolean;

	/**
	 * (NOT IMPLEMENTED) Default access level for incoming guests. The host may
	 * override this setting on a per-guest basis.
	 */
	access?: Access;
}

interface JoinOptions {
	/**
	 * Open the joined workspace in a new window, instead of re-using the current window.
	 */
	newWindow?: boolean;
	correlationId?: string;
}

/**
 * Represents a local TCP server listening on the given port.
 */
interface Server {
	/**
	 * Local TCP port the server is listening on.
	 */
	port: number;
	/**
	 * User-friendly name of the server.
	 */
	displayName?: string;
	/**
	 * Default URL users will be redirected to when accessing the server.
	 */
	browseUrl?: string;
}

enum Role {
	None = 0,
	Host = 1,
	Guest = 2,
}

/** This is just a placeholder for a richer access control model to be added later. */
enum Access {
	None = 0,
	ReadOnly = 1,
	ReadWrite = 3,
	Owner = 0xFF,
}

/**
 * Authenticated Live Share user information.
 *
 * NOTE: Access to user information may be restricted.
 * If the caller is not permitted, the `Peer.user` property returns 'null'.
 */
interface UserInfo {
	/**
	 * User display name.
	 */
	readonly displayName: string;

	/**
	 * Validated email address.
	 */
	readonly emailAddress: string | null;

	/**
	 * The username that the provider (e.g. GitHub) makes available.
	 */
	readonly userName: string | null;

	/**
	 * User id. This is persistent ID that stays the same for the same user
	 * if the user re-joins the session and even between sessions for some time.
	 */
	readonly id: string;
}

/**
 * Represents one participant in a sharing session.
 */
interface Peer {
	/** Integer that uniquely identifies a peer within the scope of a session. */
	readonly peerNumber: number;

	/**
	 * Authenticated Live Share user information.
	 *
	 * NOTE: Access to user information may be restricted.
	 * If the caller is not permitted, this property returns 'null'.
	 */
	readonly user: UserInfo | null;

	/**
	 * Role within the session. Each session has exactly one host; the rest of
	 * the peers are guests.
	 */
	readonly role: Role;

	/**
	 * Access level within the session. The host has full "owner" access to the
	 * session. Guests may have their access limited by the host.
	 */
	readonly access: Access;
}

/**
 * Information about the current session, including user information (in the base class).
 */
interface Session extends Peer {
	/**
	 * Globally unique identifier for the current session, or null if there is no active session.
	 */
	readonly id: string | null;
}

interface SessionChangeEvent {
	readonly session: Session;
}

interface PeersChangeEvent {
	readonly added: Peer[];
	readonly removed: Peer[];
}

interface RequestHandler {
	(args: any[], cancellation: vscode.CancellationToken): any | Promise<any>;
}

interface NotifyHandler {
	(args: object): void;
}

/**
 * A service that is provided by the host for use by guests.
 */
export interface SharedService {
	/** A shared service is available when a sharing session is active as a Host. */
	readonly isServiceAvailable: boolean;
	readonly onDidChangeIsServiceAvailable: vscode.Event<boolean>;

	/**
	 * Registers a callback to be invoked when a request is sent to the service.
	 *
	 * @param name Request method name
	 */
	onRequest(name: string, handler: RequestHandler): void;

	/**
	 * Registers a callback to be invoked when a notification is sent to the service.
	 *
	 * @param name Notify event name
	 */
	onNotify(name: string, handler: NotifyHandler): void;

	/**
	 * Sends a notification (event) from the service. Does not wait for a response.
	 *
	 * If no sharing session is active, this method does nothing.
	 *
	 * @param name notify event name
	 * @param args notify event args object
	 */
	notify(name: string, args: object): void;
}

/**
 * A proxy that allows guests to access a host-provided service.
 */
export interface SharedServiceProxy {
	/**
	 * A shared service proxy is available when a sharing session is active as a
	 * Guest, and the Host has shared a service with the same name.
	 */
	readonly isServiceAvailable: boolean;
	readonly onDidChangeIsServiceAvailable: vscode.Event<boolean>;

	/**
	 * Registers a callback to be invoked when a notification is sent by the service.
	 *
	 * @param name notify event name
	 */
	onNotify(name: string, handler: NotifyHandler): void;

	/**
	 * Sends a request (method call) to the service and waits for a response.
	 *
	 * @param name request method name
	 *
	 * @returns a promise that waits asynchronously for a response
	 *
	 * @throws SharedServiceProxyError if the service is not currently available
	 * (because there is no active sharing session or no peer has provided the service)
	 *
	 * @throws SharedServiceResponseError (via rejected promise) if the service's
	 * request handler throws an error
	 */
	request(name: string, args: any[], cancellation?: vscode.CancellationToken): Promise<any>;

	/**
	 * Sends a notification (event) to the service. (Does not wait for a response.)
	 *
	 * If the service is not currently available (either because there is
	 * no active sharing session or because no peer has provided the service)
	 * then this method does nothing.
	 *
	 * @param name notify event name
	 * @param args notify event args object
	 */
	notify(name: string, args: object): void;
}

/**
 * Identifiers for Live Share tree views. These identifiers may be used by other extensions
 * to extend Live Share tree views with additional nodes via the `registerTreeDataProvider()`
 * API.
 */
enum View {
	Session = 'liveshare.session',
	ExplorerSession = 'liveshare.session.explorer',
	Contacts = 'liveshare.contacts',
	Help = 'liveshare.help',
}

interface InviteContactOptions {

	/**
	 * This option will force the invite to only use the email channel
	 */
	useEmail?: boolean;
}

/**
 * Represent a contact with live presence support
 */
interface Contact {
	readonly onDidChange: vscode.Event<string[]>;
	readonly id: string;
	readonly email: string;
	readonly displayName?: string;
	readonly status?: string;
	readonly avatarUri?: string;

	invite(options?: InviteContactOptions): Promise<boolean>;
}

/**
 * Represent a collection of contacts that can be disposed at once
 */
interface ContactsCollection {
	readonly contacts: { [email: string]: Contact };
	dispose(): Promise<void>;
}
