/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { PerformanceMark } from 'vs/base/common/performance';
import type { UriComponents, URI } from 'vs/base/common/uri';
import type { IWebSocketFactory } from 'vs/platform/remote/browser/browserSocketFactory';
import type { IURLCallbackProvider } from 'vs/workbench/services/url/browser/urlService';
import type { LogLevel } from 'vs/platform/log/common/log';
import type { IUpdateProvider } from 'vs/workbench/services/update/browser/updateService';
import type { Event } from 'vs/base/common/event';
import type { IWorkspaceProvider } from 'vs/workbench/services/host/browser/browserHostService';
import type { IProductConfiguration } from 'vs/base/common/product';
import type { ICredentialsProvider } from 'vs/platform/credentials/common/credentials';
import type { TunnelProviderFeatures } from 'vs/platform/tunnel/common/tunnel';
import type { IProgress, IProgressCompositeOptions, IProgressDialogOptions, IProgressNotificationOptions, IProgressOptions, IProgressStep, IProgressWindowOptions } from 'vs/platform/progress/common/progress';
import { IObservableValue } from 'vs/base/common/observableValue';
import { TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { IEditorOptions } from 'vs/platform/editor/common/editor';

/**
 * The `IWorkbench` interface is the API facade for web embedders
 * to call into the workbench.
 *
 * Note: Changes to this interface need to be announced and adopted.
 */
export interface IWorkbench {

	commands: {

		/**
		* Allows to execute any command if known with the provided arguments.
		*
		* @param command Identifier of the command to execute.
		* @param rest Parameters passed to the command function.
		* @return A promise that resolves to the returned value of the given command.
		*/
		executeCommand(command: string, ...args: any[]): Promise<unknown>;
	};

	env: {

		/**
		 * @returns the scheme to use for opening the associated desktop
		 * experience via protocol handler.
		 */
		getUriScheme(): Promise<string>;

		/**
		 * Retrieve performance marks that have been collected during startup. This function
		 * returns tuples of source and marks. A source is a dedicated context, like
		 * the renderer or an extension host.
		 *
		 * *Note* that marks can be collected on different machines and in different processes
		 * and that therefore "different clocks" are used. So, comparing `startTime`-properties
		 * across contexts should be taken with a grain of salt.
		 *
		 * @returns A promise that resolves to tuples of source and marks.
		 */
		retrievePerformanceMarks(): Promise<[string, readonly PerformanceMark[]][]>;

		/**
		 * Allows to open a `URI` with the standard opener service of the
		 * workbench.
		 */
		openUri(target: URI): Promise<boolean>;

		/**
		 * Current workbench telemetry level.
		 */
		readonly telemetryLevel: IObservableValue<TelemetryLevel>;
	};

	window: {
		/**
		 * Show progress in the editor. Progress is shown while running the given callback
		 * and while the promise it returned isn't resolved nor rejected.
		 *
		 * @param task A callback returning a promise.
		 * @return A promise that resolves to the returned value of the given task result.
		 */
		withProgress<R>(
			options: IProgressOptions | IProgressDialogOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
			task: (progress: IProgress<IProgressStep>) => Promise<R>
		): Promise<R>;
	};

	/**
	 * Triggers shutdown of the workbench programmatically. After this method is
	 * called, the workbench is not usable anymore and the page needs to reload
	 * or closed.
	 *
	 * This will also remove any `beforeUnload` handlers that would bring up a
	 * confirmation dialog.
	 *
	 * The returned promise should be awaited on to ensure any data to persist
	 * has been persisted.
	 */
	shutdown: () => Promise<void>;
}

export interface IWorkbenchConstructionOptions {

	//#region Connection related configuration

	/**
	 * The remote authority is the IP:PORT from where the workbench is served
	 * from. It is for example being used for the websocket connections as address.
	 */
	readonly remoteAuthority?: string;

	/**
	 * The connection token to send to the server.
	 */
	readonly connectionToken?: string;

	/**
	 * An endpoint to serve iframe content ("webview") from. This is required
	 * to provide full security isolation from the workbench host.
	 */
	readonly webviewEndpoint?: string;

	/**
	 * A factory for web sockets.
	 */
	readonly webSocketFactory?: IWebSocketFactory;

	/**
	 * A provider for resource URIs.
	 */
	readonly resourceUriProvider?: IResourceUriProvider;

	/**
	 * Resolves an external uri before it is opened.
	 */
	readonly resolveExternalUri?: IExternalUriResolver;

	/**
	 * A provider for supplying tunneling functionality,
	 * such as creating tunnels and showing candidate ports to forward.
	 */
	readonly tunnelProvider?: ITunnelProvider;

	/**
	 * Endpoints to be used for proxying authentication code exchange calls in the browser.
	 */
	readonly codeExchangeProxyEndpoints?: { [providerId: string]: string };

	/**
	 * [TEMPORARY]: This will be removed soon.
	 * Endpoints to be used for proxying repository tarball download calls in the browser.
	 */
	readonly _tarballProxyEndpoints?: { [providerId: string]: string };

	//#endregion


	//#region Workbench configuration

	/**
	 * A handler for opening workspaces and providing the initial workspace.
	 */
	readonly workspaceProvider?: IWorkspaceProvider;

	/**
	 * Settings sync options
	 */
	readonly settingsSyncOptions?: ISettingsSyncOptions;

	/**
	 * The credentials provider to store and retrieve secrets.
	 */
	readonly credentialsProvider?: ICredentialsProvider;

	/**
	 * Additional builtin extensions those cannot be uninstalled but only be disabled.
	 * It can be one of the following:
	 * 	- an extension in the Marketplace
	 * 	- location of the extension where it is hosted.
	 */
	readonly additionalBuiltinExtensions?: readonly (MarketplaceExtension | UriComponents)[];

	/**
	 * List of extensions to be enabled if they are installed.
	 * Note: This will not install extensions if not installed.
	 */
	readonly enabledExtensions?: readonly ExtensionId[];

	/**
	 * Additional domains allowed to open from the workbench without the
	 * link protection popup.
	 */
	readonly additionalTrustedDomains?: string[];

	/**
	 * Enable workspace trust feature for the current window
	 */
	readonly enableWorkspaceTrust?: boolean;

	/**
	 * Urls that will be opened externally that are allowed access
	 * to the opener window. This is primarily used to allow
	 * `window.close()` to be called from the newly opened window.
	 */
	readonly openerAllowedExternalUrlPrefixes?: string[];

	/**
	 * Support for URL callbacks.
	 */
	readonly urlCallbackProvider?: IURLCallbackProvider;

	/**
	 * Support adding additional properties to telemetry.
	 */
	readonly resolveCommonTelemetryProperties?: ICommonTelemetryPropertiesResolver;

	/**
	 * A set of optional commands that should be registered with the commands
	 * registry.
	 *
	 * Note: commands can be called from extensions if the identifier is known!
	 */
	readonly commands?: readonly ICommand[];

	/**
	 * Optional default layout to apply on first time the workspace is opened (uness `force` is specified).
	 */
	readonly defaultLayout?: IDefaultLayout;

	/**
	 * Optional configuration default overrides contributed to the workbench.
	 */
	readonly configurationDefaults?: Record<string, any>;

	//#endregion


	//#region Update/Quality related

	/**
	 * Support for update reporting
	 */
	readonly updateProvider?: IUpdateProvider;

	/**
	 * Support for product quality switching
	 */
	readonly productQualityChangeHandler?: IProductQualityChangeHandler;

	//#endregion


	//#region Branding

	/**
	 * Optional home indicator to appear above the hamburger menu in the activity bar.
	 */
	readonly homeIndicator?: IHomeIndicator;

	/**
	 * Optional welcome banner to appear above the workbench. Can be dismissed by the
	 * user.
	 */
	readonly welcomeBanner?: IWelcomeBanner;

	/**
	 * Optional override for the product configuration properties.
	 */
	readonly productConfiguration?: Partial<IProductConfiguration>;

	/**
	 * Optional override for properties of the window indicator in the status bar.
	 */
	readonly windowIndicator?: IWindowIndicator;

	/**
	 * Specifies the default theme type (LIGHT, DARK..) and allows to provide initial colors that are shown
	 * until the color theme that is specified in the settings (`editor.colorTheme`) is loaded and applied.
	 * Once there are persisted colors from a last run these will be used.
	 *
	 * The idea is that the colors match the main colors from the theme defined in the `configurationDefaults`.
	 */
	readonly initialColorTheme?: IInitialColorTheme;

	//#endregion


	//#region IPC

	readonly messagePorts?: ReadonlyMap<ExtensionId, MessagePort>;

	//#endregion


	//#region Development options

	readonly developmentOptions?: IDevelopmentOptions;

	//#endregion

}

export interface IResourceUriProvider {
	(uri: URI): URI;
}

/**
 * The identifier of an extension in the format: `PUBLISHER.NAME`. For example: `vscode.csharp`
 */
export type ExtensionId = string;

export type MarketplaceExtension = ExtensionId | { readonly id: ExtensionId; preRelease?: boolean; migrateStorageFrom?: ExtensionId };

export interface ICommonTelemetryPropertiesResolver {
	(): { [key: string]: any };
}

export interface IExternalUriResolver {
	(uri: URI): Promise<URI>;
}

export interface IExternalURLOpener {

	/**
	 * Overrides the behavior when an external URL is about to be opened.
	 * Returning false means that the URL wasn't handled, and the default
	 * handling behavior should be used: `window.open(href, '_blank', 'noopener');`
	 *
	 * @returns true if URL was handled, false otherwise.
	 */
	openExternal(href: string): boolean | Promise<boolean>;
}

export interface ITunnelProvider {

	/**
	 * Support for creating tunnels.
	 */
	tunnelFactory?: ITunnelFactory;

	/**
	 * Support for filtering candidate ports.
	 */
	showPortCandidate?: IShowPortCandidate;

	/**
	 * The features that the tunnel provider supports.
	 */
	features?: TunnelProviderFeatures;
}

export interface ITunnelFactory {
	(tunnelOptions: ITunnelOptions, tunnelCreationOptions: TunnelCreationOptions): Promise<ITunnel> | undefined;
}

export interface ITunnelOptions {

	remoteAddress: { port: number; host: string };

	/**
	 * The desired local port. If this port can't be used, then another will be chosen.
	 */
	localAddressPort?: number;

	label?: string;

	/**
	 * @deprecated Use privacy instead
	 */
	public?: boolean;

	privacy?: string;

	protocol?: string;
}

export interface TunnelCreationOptions {

	/**
	 * True when the local operating system will require elevation to use the requested local port.
	 */
	elevationRequired?: boolean;
}

export interface ITunnel {

	remoteAddress: { port: number; host: string };

	/**
	 * The complete local address(ex. localhost:1234)
	 */
	localAddress: string;

	/**
	 * @deprecated Use privacy instead
	 */
	public?: boolean;

	privacy?: string;

	/**
	 * If protocol is not provided, it is assumed to be http, regardless of the localAddress
	 */
	protocol?: string;

	/**
	 * Implementers of Tunnel should fire onDidDispose when dispose is called.
	 */
	onDidDispose: Event<void>;

	dispose(): Promise<void> | void;
}

export interface IShowPortCandidate {
	(host: string, port: number, detail: string): Promise<boolean>;
}

export enum Menu {
	CommandPalette,
	StatusBarWindowIndicatorMenu,
}

export interface ICommand {

	/**
	 * An identifier for the command. Commands can be executed from extensions
	 * using the `vscode.commands.executeCommand` API using that command ID.
	 */
	id: string;

	/**
	 * The optional label of the command. If provided, the command will appear
	 * in the command palette.
	 */
	label?: string;

	/**
	 * The optional menus to append this command to. Only valid if `label` is
	 * provided as well.
	 * @default Menu.CommandPalette
	 */
	menu?: Menu | Menu[];

	/**
	 * A function that is being executed with any arguments passed over. The
	 * return type will be send back to the caller.
	 *
	 * Note: arguments and return type should be serializable so that they can
	 * be exchanged across processes boundaries.
	 */
	handler: (...args: any[]) => unknown;
}

export interface IHomeIndicator {

	/**
	 * The link to open when clicking the home indicator.
	 */
	href: string;

	/**
	 * The icon name for the home indicator. This needs to be one of the existing
	 * icons from our Codicon icon set. For example `code`.
	 */
	icon: string;

	/**
	 * A tooltip that will appear while hovering over the home indicator.
	 */
	title: string;
}

export interface IWelcomeBanner {

	/**
	 * Welcome banner message to appear as text.
	 */
	message: string;

	/**
	 * Optional icon for the banner. This is either the URL to an icon to use
	 * or the name of one of the existing icons from our Codicon icon set.
	 *
	 * If not provided a default icon will be used.
	 */
	icon?: string | UriComponents;

	/**
	 * Optional actions to appear as links after the welcome banner message.
	 */
	actions?: IWelcomeBannerAction[];
}

export interface IWelcomeBannerAction {

	/**
	 * The link to open when clicking. Supports command invocation when
	 * using the `command:<commandId>` value.
	 */
	href: string;

	/**
	 * The label to show for the action link.
	 */
	label: string;

	/**
	 * A tooltip that will appear while hovering over the action link.
	 */
	title?: string;
}

export interface IWindowIndicator {

	/**
	 * Triggering this event will cause the window indicator to update.
	 */
	readonly onDidChange?: Event<void>;

	/**
	 * Label of the window indicator may include octicons
	 * e.g. `$(remote) label`
	 */
	label: string;

	/**
	 * Tooltip of the window indicator should not include
	 * octicons and be descriptive.
	 */
	tooltip: string;

	/**
	 * If provided, overrides the default command that
	 * is executed when clicking on the window indicator.
	 */
	command?: string;
}

export enum ColorScheme {
	DARK = 'dark',
	LIGHT = 'light',
	HIGH_CONTRAST_LIGHT = 'hcLight',
	HIGH_CONTRAST_DARK = 'hcDark'
}

export interface IInitialColorTheme {

	/**
	 * Initial color theme type.
	 */
	readonly themeType: ColorScheme;

	/**
	 * A list of workbench colors to apply initially.
	 */
	readonly colors?: { [colorId: string]: string };
}

export interface IDefaultView {
	readonly id: string;
}

/**
 * @deprecated use `IDefaultEditor.options` instead
 */
export interface IPosition {
	readonly line: number;
	readonly column: number;
}

/**
 * @deprecated use `IDefaultEditor.options` instead
 */
export interface IRange {
	readonly start: IPosition;
	readonly end: IPosition;
}

export interface IDefaultEditor {

	readonly uri: UriComponents;
	readonly options?: IEditorOptions;

	readonly openOnlyIfExists?: boolean;

	/**
	 * @deprecated use `options` instead
	 */
	readonly selection?: IRange;

	/**
	 * @deprecated use `options.override` instead
	 */
	readonly openWith?: string;
}

export interface IDefaultLayout {

	readonly views?: IDefaultView[];
	readonly editors?: IDefaultEditor[];

	/**
	 * Forces this layout to be applied even if this isn't
	 * the first time the workspace has been opened
	 */
	readonly force?: boolean;
}

export interface IProductQualityChangeHandler {

	/**
	 * Handler is being called when the user wants to switch between
	 * `insider` or `stable` product qualities.
	 */
	(newQuality: 'insider' | 'stable'): void;
}

/**
 * Settings sync options
 */
export interface ISettingsSyncOptions {

	/**
	 * Is settings sync enabled
	 */
	readonly enabled: boolean;

	/**
	 * Version of extensions sync state.
	 * Extensions sync state will be reset if version is provided and different from previous version.
	 */
	readonly extensionsSyncStateVersion?: string;

	/**
	 * Handler is being called when the user changes Settings Sync enablement.
	 */
	enablementHandler?(enablement: boolean): void;
}

export interface IDevelopmentOptions {

	/**
	 * Current logging level. Default is `LogLevel.Info`.
	 */
	readonly logLevel?: LogLevel;

	/**
	 * Location of a module containing extension tests to run once the workbench is open.
	 */
	readonly extensionTestsPath?: UriComponents;

	/**
	 * Add extensions under development.
	 */
	readonly extensions?: readonly UriComponents[];

	/**
	 * Whether to enable the smoke test driver.
	 */
	readonly enableSmokeTestDriver?: boolean;
}
