/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {IExtensionConstants} from 'extensions-modules/lib/models/contracts/contracts';
import {Runtime, LinuxDistribution} from 'extensions-modules/lib/models/platform';

// constants
export class Constants implements IExtensionConstants {
    public readonly languageId = 'sql';
    public readonly extensionName = 'mssql';
    public readonly extensionConfigSectionName = 'mssql';
    public readonly connectionApplicationName = 'vscode-mssql';
    public readonly outputChannelName = 'MSSQL';
    public readonly connectionConfigFilename = 'settings.json';
    public readonly connectionsArrayName = 'mssql.connections';
    public readonly cmdRunQuery = 'extension.runQuery';
    public readonly cmdCancelQuery = 'extension.cancelQuery';
    public readonly cmdConnect = 'extension.connect';
    public readonly cmdDisconnect = 'extension.disconnect';
    public readonly cmdChooseDatabase = 'extension.chooseDatabase';
    public readonly cmdShowReleaseNotes = 'extension.showReleaseNotes';
    public readonly cmdShowGettingStarted = 'extension.showGettingStarted';
    public readonly cmdNewQuery = 'extension.newQuery';
    public readonly cmdManageConnectionProfiles = 'extension.manageProfiles';
    public readonly sqlDbPrefix = '.database.windows.net';
    public readonly defaultConnectionTimeout = 15;
    public readonly azureSqlDbConnectionTimeout = 30;
    public readonly azureDatabase = 'Azure';
    public readonly defaultPortNumber = 1433;
    public readonly sqlAuthentication = 'SqlLogin';
    public readonly defaultDatabase = 'master';
    public readonly errorPasswordExpired = 18487;
    public readonly errorPasswordNeedsReset = 18488;
    public readonly maxDisplayedStatusTextLength = 50;
    public readonly outputContentTypeRoot = 'root';
    public readonly outputContentTypeMessages = 'messages';
    public readonly outputContentTypeResultsetMeta = 'resultsetsMeta';
    public readonly outputContentTypeColumns = 'columns';
    public readonly outputContentTypeRows = 'rows';
    public readonly outputContentTypeConfig = 'config';
    public readonly outputContentTypeSaveResults = 'saveResults';
    public readonly outputContentTypeOpenLink = 'openLink';
    public readonly outputContentTypeCopy = 'copyResults';
    public readonly outputContentTypeEditorSelection = 'setEditorSelection';
    public readonly outputContentTypeShowError = 'showError';
    public readonly outputContentTypeShowWarning = 'showWarning';
    public readonly outputServiceLocalhost = 'http://localhost:';
    public readonly msgContentProviderSqlOutputHtml = 'dist/html/sqlOutput.ejs';
    public readonly contentProviderMinFile = 'dist/js/app.min.js';
    public readonly configLogDebugInfo = 'logDebugInfo';
    public readonly providerId = 'MSSQL';
    public readonly installFolderName = 'sqltoolsservice';
    public readonly telemetryExtensionName = 'carbon-mssql';

    // localizable strings
    public readonly configMyConnectionsNoServerName = 'Missing server name in user preferences connection: ';
    public readonly msgLocalWebserviceStaticContent = 'LocalWebService: added static html content path: ';
    public readonly msgLocalWebserviceStarted = 'LocalWebService listening on port ';
    public readonly msgRunQueryAllBatchesExecuted = 'runQuery: all batches executed';
    public readonly msgStartedExecute = 'Started query execution for document "{0}"';
    public readonly msgFinishedExecute = 'Finished query execution for document "{0}"';
    public readonly msgRunQueryError = 'runQuery: error: ';
    public readonly msgRunQueryExecutingBatch = 'runQuery: executeBatch called with SQL: ';
    public readonly msgRunQueryAddBatchResultsets = 'runQuery: adding resultsets for batch: ';
    public readonly msgRunQueryAddBatchError = 'runQuery: adding error message for batch: ';
    public readonly msgRunQueryConnectionActive = 'runQuery: active connection is connected, using it to run query';
    public readonly msgRunQueryConnectionDisconnected = 'runQuery: active connection is disconnected, reconnecting';
    public readonly msgRunQueryNoConnection = 'runQuery: no active connection - prompting for user';
    public readonly msgRunQueryInProgress = 'A query is already running for this editor session. Please cancel this query or wait for its completion.';
    public readonly runQueryBatchStartMessage = 'Started executing query at ';
    public readonly runQueryBatchStartLine = 'Line {0}';
    public readonly msgCancelQueryFailed = 'Canceling the query failed: {0}';
    public readonly msgCancelQueryNotRunning = 'Cannot cancel query as no query is running.';
    public readonly msgCancelQuerySuccess = 'Successfully canceled the query.';
    public readonly msgContentProviderOnContentUpdated = 'Content provider: onContentUpdated called';
    public readonly msgContentProviderAssociationFailure = 'Content provider: Unable to associate status view for current file';
    public readonly msgContentProviderOnRootEndpoint = 'LocalWebService: Root end-point called';
    public readonly msgContentProviderOnResultsEndpoint = 'LocalWebService: ResultsetsMeta endpoint called';
    public readonly msgContentProviderOnMessagesEndpoint = 'LocalWebService: Messages end-point called';
    public readonly msgContentProviderOnColumnsEndpoint = 'LocalWebService:  Columns end-point called for index = ';
    public readonly msgContentProviderOnRowsEndpoint = 'LocalWebService: Rows end-point called for index = ';
    public readonly msgContentProviderOnClear = 'Content provider: clear called';
    public readonly msgContentProviderOnUpdateContent = 'Content provider: updateContent called';
    public readonly msgContentProviderProvideContent = 'Content provider: provideTextDocumentContent called: ';
    public readonly msgChooseDatabaseNotConnected = 'No connection was found. Please connect to a server first.';
    public readonly msgChooseDatabasePlaceholder = 'Choose a database from the list below';
    public readonly msgConnectionError = 'Error {0}: {1}';
    public readonly msgConnectionError2 = 'Failed to connect: {0}';
    public readonly msgConnectionErrorPasswordExpired = 'Error {0}: {1} Please login as a different user and change the password using ALTER LOGIN.';
    public readonly connectionErrorChannelName = 'Connection Errors';
    public readonly msgPromptCancelConnect = 'Server connection in progress. Do you want to cancel?';
    public readonly msgPromptClearRecentConnections = 'Confirm to clear recent connections list';
    public readonly msgOpenSqlFile = 'To use this command, Open a .sql file -or- ' +
                                      'Change editor language to "SQL" -or- ' +
                                      'Select T-SQL text in the active SQL editor.';
    public readonly recentConnectionsPlaceholder = 'Choose a connection profile from the list below';
    public readonly msgNoConnectionsInSettings = 'To use this command, add connection profile to User Settings.';
    public readonly labelOpenGlobalSettings = 'Open Global Settings';
    public readonly labelOpenWorkspaceSettings = 'Open Workspace Settings';
    public readonly CreateProfileFromConnectionsListLabel = 'Create Connection Profile';
    public readonly CreateProfileLabel = 'Create';
    public readonly ClearRecentlyUsedLabel = 'Clear Recent Connections List';
    public readonly EditProfilesLabel = 'Edit';
    public readonly RemoveProfileLabel = 'Remove';
    public readonly ManageProfilesPrompt = 'Manage Connection Profiles';
    public readonly SampleServerName = '{{put-server-name-here}}';
    public readonly serverPrompt = 'Server name';
    public readonly serverPlaceholder = 'hostname\\instance or <server>.database.windows.net';
    public readonly databasePrompt = 'Database name';
    public readonly databasePlaceholder = '[Optional] Database to connect (press Enter to connect to <default> database)';
    public readonly databaseDefaultValue = 'master';
    public readonly authTypePrompt = 'Authentication Type';
    public readonly authTypeIntegrated = 'Integrated';
    public readonly authTypeSql = 'SQL Login';
    public readonly authTypeAdUniversal = 'Active Directory Universal';
    public readonly usernamePrompt = 'User name';
    public readonly usernamePlaceholder = 'User name (SQL Login)';
    public readonly passwordPrompt = 'Password';
    public readonly passwordPlaceholder = 'Password (SQL Login)';
    public readonly msgSavePassword = 'Save Password? If \'No\', password will be required each time you connect';
    public readonly profileNamePrompt = 'Profile Name';
    public readonly profileNamePlaceholder = '[Optional] Enter a name for this profile';
    public readonly filepathPrompt = 'File path';
    public readonly filepathPlaceholder = 'File name';
    public readonly filepathMessage = 'File name';
    public readonly overwritePrompt = 'A file with this name already exists. Do you want to replace the existing file?';
    public readonly overwritePlaceholder = 'A file with this name already exists';
    public readonly msgSaveResultInProgress = 'A save request is already executing. Please wait for its completion.';
    public readonly msgCannotOpenContent = 'Error occurred opening content in editor.';
    public readonly msgSaveStarted = 'Started saving results to ';
    public readonly msgSaveFailed = 'Failed to save results. ';
    public readonly msgSaveSucceeded = 'Successfully saved results to ';
    public readonly msgSelectProfile = 'Select connection profile';
    public readonly msgSelectProfileToRemove = 'Select profile to remove';
    public readonly confirmRemoveProfilePrompt = 'Confirm to remove this profile.';
    public readonly msgNoProfilesSaved = 'No connection profile to remove.';
    public readonly msgProfileRemoved = 'Profile removed successfully';
    public readonly msgProfileCreated = 'Profile created successfully';
    public readonly msgProfileCreatedAndConnected = 'Profile created and connected';
    public readonly msgClearedRecentConnections = 'Recent connections list cleared';
    public readonly msgSelectionIsRequired = 'Selection is required.';
    public readonly msgIsRequired = ' is required.';
    public readonly msgRetry = 'Retry';
    public readonly msgError = 'Error: ';
    public readonly msgYes = 'Yes';
    public readonly msgNo = 'No';
    public readonly defaultDatabaseLabel = '<default>';
    public readonly notConnectedLabel = 'Disconnected';
    public readonly notConnectedTooltip = 'Click to connect to a database';
    public readonly connectingLabel = 'Connecting';
    public readonly connectingTooltip = 'Connecting to: ';
    public readonly connectedLabel = 'Connected.';
    public readonly connectErrorLabel = 'Connection error';
    public readonly connectErrorTooltip = 'Error connecting to: ';
    public readonly connectErrorCode = 'Errorcode: ';
    public readonly connectErrorMessage = 'ErrorMessage: ';
    public readonly executeQueryLabel = 'Executing query ';
    public readonly cancelingQueryLabel = 'Canceling query ';
    public readonly updatingIntelliSenseLabel = 'Updating IntelliSense...';
    public readonly unfoundResult = 'Data was disposed when text editor was closed; to view data please reexecute query.';
    public readonly serviceCompatibleVersion = '1.0.0';
    public readonly serviceNotCompatibleError = 'Client is not compatible with the service layer';
    public readonly serviceInstallingTo = 'Installing SQL tools service to';
    public readonly serviceInitializing = 'Initializing SQL tools service for the mssql extension.';
    public readonly commandsNotAvailableWhileInstallingTheService = 'Note: mssql commands will be available after installing the service.';
    public readonly serviceInstalled = 'Sql Tools Service installed';
    public readonly serviceInstallationFailed = 'Failed to install Sql Tools Service';
    public readonly serviceLoadingFailed = 'Failed to load Sql Tools Service';
    public readonly invalidServiceFilePath = 'Invalid file path for Sql Tools Service';
    public readonly extensionNotInitializedError = 'Unable to execute the command while the extension is initializing. Please try again later.';
    public readonly untitledScheme = 'untitled';
    public readonly untitledSaveTimeThreshold = 10.0;
    public readonly renamedOpenTimeThreshold = 10.0;
    public readonly msgChangeLanguageMode = 'To use this command, you must set the language to \"SQL\". Confirm to change language mode.';
    public readonly timeToWaitForLanguageModeChange = 10000.0;
    public readonly msgChangedDatabaseContext = 'Changed database context to \"{0}\" for document \"{1}\"';
    public readonly msgPromptRetryCreateProfile = 'Error: Unable to connect using the connection information provided. Retry profile creation?';
    public readonly retryLabel = 'Retry';
    public readonly msgConnecting = 'Connecting to server \"{0}\" on document \"{1}\".';
    public readonly msgConnectedServerInfo = 'Connected to server \"{0}\" on document \"{1}\". Server information: {2}';
    public readonly msgConnectionFailed = 'Error connecting to server \"{0}\". Details: {1}';
    public readonly msgChangingDatabase = 'Changing database context to \"{0}\" on server \"{1}\" on document \"{2}\".';
    public readonly msgChangedDatabase = 'Changed database context to \"{0}\" on server \"{1}\" on document \"{2}\".';
    public readonly msgDisconnected = 'Disconnected on document \"{0}\"';
    public readonly msgErrorReadingConfigFile = 'Error: Unable to load connection profiles from [{0}]. Check if the file is formatted correctly.';
    public readonly msgErrorOpeningConfigFile = 'Error: Unable to open connection profile settings file.';
    public readonly extConfigResultKeys = ['shortcuts', 'messagesDefaultOpen'];
    public readonly extConfigResultFontFamily = 'resultsFontFamily';
    public readonly extConfigResultFontSize = 'resultsFontSize';
    public readonly titleResultsPane = 'Results: {0}';
    public readonly macOpenSslErrorMessage = `OpenSSL version >=1.0.1 is required to connect.`;
    public readonly macOpenSslHelpButton = 'Help';
    public readonly macOpenSslHelpLink = 'https://github.com/Microsoft/vscode-mssql/wiki/OpenSSL-Configuration';
    public readonly serviceName = 'SQLToolsService';
    public readonly serviceInitializingOutputChannelName = 'SqlToolsService Initialization';
    public readonly gettingStartedGuideLink = 'https://aka.ms/mssql-getting-started';
    public readonly serviceCrashMessage = 'SQL Tools Service component exited unexpectedly. Please restart SQL Operations Studio.';
    public readonly serviceCrashLink = 'https://github.com/Microsoft/vscode-mssql/wiki/SqlToolsService-Known-Issues';
    public readonly gettingDefinitionMessage = 'Getting definition ...';
    public readonly definitionRequestedStatus = 'DefinitionRequested';
    public readonly definitionRequestCompletedStatus = 'DefinitionRequestCompleted';
    public readonly updatingIntelliSenseStatus = 'updatingIntelliSense';
    public readonly intelliSenseUpdatedStatus = 'intelliSenseUpdated';

    /**
     * Returns a supported .NET Core Runtime ID (RID) for the current platform. The list of Runtime IDs
     * is available at https://github.com/dotnet/corefx/tree/master/pkg/Microsoft.NETCore.Platforms.
     */
    public getRuntimeId(platform: string, architecture: string, distribution: LinuxDistribution): Runtime {
        switch (platform) {
            case 'win32':
                switch (architecture) {
                    case 'x86': return Runtime.Windows_86;
                    case 'x86_64': return Runtime.Windows_64;
                    default:
                }

                throw new Error(`Unsupported Windows architecture: ${architecture}`);

            case 'darwin':
                if (architecture === 'x86_64') {
                    // Note: We return the El Capitan RID for Sierra
                    return Runtime.OSX;
                }

                throw new Error(`Unsupported macOS architecture: ${architecture}`);

            case 'linux':
                if (architecture === 'x86_64') {

                    // First try the distribution name
                    let runtimeId = Constants.getRuntimeIdHelper(distribution.name, distribution.version);

                    // If the distribution isn't one that we understand, but the 'ID_LIKE' field has something that we understand, use that
                    //
                    // NOTE: 'ID_LIKE' doesn't specify the version of the 'like' OS. So we will use the 'VERSION_ID' value. This will restrict
                    // how useful ID_LIKE will be since it requires the version numbers to match up, but it is the best we can do.
                    if (runtimeId === Runtime.UnknownRuntime && distribution.idLike && distribution.idLike.length > 0) {
                        for (let id of distribution.idLike) {
                            runtimeId = Constants.getRuntimeIdHelper(id, distribution.version);
                            if (runtimeId !== Runtime.UnknownRuntime) {
                                break;
                            }
                        }
                    }

                    if (runtimeId !== Runtime.UnknownRuntime && runtimeId !== Runtime.UnknownVersion) {
                        return runtimeId;
                    }
                }

                // If we got here, this is not a Linux distro or architecture that we currently support.
                throw new Error(`Unsupported Linux distro: ${distribution.name}, ${distribution.version}, ${architecture}`);
            default :
                 // If we got here, we've ended up with a platform we don't support  like 'freebsd' or 'sunos'.
                 // Chances are, VS Code doesn't support these platforms either.
                 throw Error('Unsupported platform ' + platform);
        }
    }

    private static getRuntimeIdHelper(distributionName: string, distributionVersion: string): Runtime {
        switch (distributionName) {
            case 'ubuntu':
                if (distributionVersion.startsWith('14')) {
                    // This also works for Linux Mint
                    return Runtime.Ubuntu_14;
                } else if (distributionVersion.startsWith('16')) {
                    return Runtime.Ubuntu_16;
                }

                break;
            case 'elementary':
            case 'elementary OS':
                if (distributionVersion.startsWith('0.3')) {
                    // Elementary OS 0.3 Freya is binary compatible with Ubuntu 14.04
                    return Runtime.Ubuntu_14;
                } else if (distributionVersion.startsWith('0.4')) {
                    // Elementary OS 0.4 Loki is binary compatible with Ubuntu 16.04
                    return Runtime.Ubuntu_16;
                }

                break;
            case 'linuxmint':
                if (distributionVersion.startsWith('18')) {
                    // Linux Mint 18 is binary compatible with Ubuntu 16.04
                    return Runtime.Ubuntu_16;
                }

                break;
            case 'centos':
            case 'ol':
                // Oracle Linux is binary compatible with CentOS
                return Runtime.CentOS_7;
            case 'fedora':
                return Runtime.Fedora_23;
            case 'opensuse':
                return Runtime.OpenSUSE_13_2;
            case 'sles':
                return Runtime.SLES_12_2;
            case 'rhel':
                return Runtime.RHEL_7;
            case 'debian':
                return Runtime.Debian_8;
            case 'galliumos':
                if (distributionVersion.startsWith('2.0')) {
                    return Runtime.Ubuntu_16;
                }
                break;
            default:
                return Runtime.UnknownRuntime;
        }

        return Runtime.UnknownVersion;
    }
}