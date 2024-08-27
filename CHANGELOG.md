# Change Log

## July 2024

Azure Data Studio 1.49.0 is the latest general availability (GA) release.

- Release number: 1.49.0
- Release date: July 31, 2024

### What's new in 1.49.0

| New Item | Details |
| --- | --- |
| SQL Database Projects Extension | Support for Fabric mirrored SQL database (preview) target platform |

### Bug fixes in 1.49.0

| New Item | Details |
| --- | --- |
| Accessibility | Accessibility improvements were made in the Database Properties dialog. |
| Query editor | Fixed query editor override of transaction isolation level setting in T-SQL script. |

## February 2024

Azure Data Studio 1.48.0 is the latest general availability (GA) release.

- Release number: 1.48.0
- Release date: February 28, 2024
 
 ### What's new in 1.48.0

| New Item | Details |
| --- | --- |
| Backup/Restore | Add restore from S3-compatible storage to restore dialog |
| Backup/Restore | Add Restore Database option to Database context menu in Object Explorer |
| Backup/Restore | Add SQL Server Restore from URL to restore dialog |
| Copilot | Add ability to change github account |
| Query Editor | Add Session ID / SPID to query editor tabs |
| Object Explorer | Add ability to enable Ledger in Create Database dialog |
| Shell | Support Connect command when launching ADS from the command line |

### Bug fixes in 1.48.0

| New Item | Details |
| --- | --- |
|Connections | Fixed Azure AD - Universal with MFA support doesn't work on Redhat Linux |
|Connections | Fixed Error: “Cannot read properties of undefined (reading 'serverInfo')” |
|Connections | Fixed proxy errors browsing Azure resources |
|Connections | Fixed Error: “UserName cannot be null or empty when using SqlLogin authentication” message when using ’Active Directory Default' authentication |
|Edit Data | Deleting row causes focus to be in wrong row |
|Notebooks | Fixed Installing Notebook dependencies failed with error: Cannot read property 'version' of undefined |
|Notebooks | Fixed "Open in editor" link in Notebooks search results doesn't work |
|Object Explorer | Removed the drop database icon from the connection browser menu |
|Query Editor | Fixed tabs not visible in query editor |
|Query Editor | Fixed query editor does not display any results when results being with “#” |
|Query Editor | Improved speed when copying data from results grid to clipboard |
|Query Editor | Fixed blank/empty results pane after executing a query |
|Query Editor | Fixed invalid results when field contains HTML or XML |

## November 2023 Hotfix 1

Azure Data Studio 1.47.1 is the latest general availability (GA) release.

- Release number: 1.47.1
- Release date: January 10, 2024

### Bug fixes in 1.47.1

| New Item | Details |
| --- | --- |
| Query Editor | Fixed query results with blank string interpreted as XML |
| Shell | Fixed not all installation files signed |
| Security | Update to [Microsoft.Data.SqlClient 5.1.3](https://github.com/dotnet/SqlClient/blob/main/release-notes/5.1/5.1.3.md) that patches [CVE-2024-0056](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-0056) |

### Known issues in 1.47.1

 New Item | Details | Workaround |
| --- | --- | --- |
| Installation | Azure Data Studio installation fails on RHEL 8 | Use RHEL 9, or manually install glibc-2.29 and add it to the Library Path and then re-install ADS |

For a list of the current known issues, visit the [issues list on GitHub](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue).

## Security Hotfix for ADS with BDC Support - Version 1.41.3
* Release date: January 10, 2024
* Release status: General Availability

### Bug fixes in 1.41.3

| New Item | Details |
| --- | --- |
| Security | Update to [Microsoft.Data.SqlClient 5.1.3](https://github.com/dotnet/SqlClient/blob/main/release-notes/5.1/5.1.3.md) that patches [CVE-2024-0056](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-0056) |

## November 2023

Azure Data Studio 1.47.0 is the latest general availability (GA) release.

- Release number: 1.47.0
- Release date: November 8, 2023
 
 ### What's new in 1.47.0

| New Item | Details |
| --- | --- |
| Connection | Improved visibility of advanced options in tabs and tooltips |
| Database Properties | Implemented usability improvements to object properties dialogs |
| Extensibility | Allow extensions to hook into provider events |
| Extensibility | Improved charting capability |
| General | Enabled `Mssql: Parallel Message Processing` by default to improve application performance when working with MSSQL connections. |
| General | Added `Mssql: Parallel Message Processing Limit` with a default of 100 to control the number of threads used for parallel processing. |
| General | Updated notifications so they close automatically upon task completion |
| Notebooks | Updated version to 6.5.6 and removed traitlets v5.9.0 from required notebook dependencies |
| Object Explorer | Added `Select Top 1000` menu option for the history table of a system-versioned temporal table |
| Object Explorer | Usability improvements including added context menus |
| Result Set | Added additional options for saving results to Excel |
| Result Set | Added support to display formatted XML data when stored as a VARCHAR data type |
| User Management | References to Azure Active Directory (Azure AD) have been updated to Microsoft Entra, see [Azure AD is Becoming Microsoft Entra ID](https://techcommunity.microsoft.com/t5/microsoft-entra-azure-ad-blog/azure-ad-is-becoming-microsoft-entra-id/ba-p/2520436) for details. |
| VS Code Merge | Merges upstream improvements from VS Code 1.80, 1.81, and 1.82. These releases contained numerous new features as well as quality, performance, stability, and compliance enhancements. The full details can be reviewed in the VS Code release notes at: [Visual Studio Code June 2023](https://code.visualstudio.com/updates/v1_80), [Visual Studio Code July 2023](https://code.visualstudio.com/updates/v1_81), and [Visual Studio Code August 2023](https://code.visualstudio.com/updates/v1_82). |

### Bug fixes in 1.47.0

| New Item | Details |
| --- | --- |
| Authentication | Fixed error "multiple matching_tokens occurred when acquiring token." when authenticating to Azure resources |
| Autocomplete | Fixed autocomplete suggests "abort" whenever new comment is begun |
| Connection | Updated prefix for Clear Pooled Connections in the command palette to use the MSSQL prefix |
| Connection | Fixed proxy setting values not being passed to backend SQL Tools Service |
| Connection | Removed tenant filter config setting |
| Extensibility | Fixed issue where server dashboard was loading before activation of extension completed |
| Notebooks | Fixed issue where the Notebook Python process continued to run after Azure Data Studio is closed |
| Notebooks | Fixed Jupyter Notebook entry in new file command under command palette does nothing |
| Object Explorer | Fixed silent failure when attempting to open script files |
| Object Explorer | Removed duplicate entry for Group By Schema from command palette |
| Object Explorer | Addressed behavior where selecting Manage for an Azure SQL Database opened the dashboard for the logical server instead of the database |
| Profiler Extension | Fixed issue where Profiler columns were not resizeable |
| Profiler Extension | Resolved problem where selecting Ctrl + F in the Profiler extension did not bring up Find dialog |
| Query Editor | Updated maximum value supported for `Query: Text Size` setting to fix results not being copied to the clipboard |
| Query Editor | Fixed issue where query editor would not open due to initialization errors |
| Query Editor | Fixed error "Cannot connect to the database due to invalid OwnerUri" after saving a new query file |
| Query History Extension | Fixed error loading query history items |
| Schema Compare | Fixed issue where schema compare does not show that it is running while doing a comparison |
| Schema Compare | Fixed issue where Azure Data Studio stops responding after attempting to apply schema compare changes |
| Shell | Shortened query tab titles for edit data |
| Shell | Updated hyperlinks to use correct theming so they are visible when using dark theme |
| Shell | Updated shell default behavior to not open any editor when `Show welcome page on startup` is not selected |
| SQL Project | Fixed issue where database project fails to build with syntax error when including a database scoped credential object |

For details about the issues addressed in the November 2023 release, visit the [November 2023 Release on GitHub](https://github.com/microsoft/azuredatastudio/milestone/105?closed=1).

## September 2023 (Hotfix 1)

Azure Data Studio 1.46.1 is the latest general availability (GA) release.

- Release number: 1.46.1
- Release date: October 3, 2023

### Bug fixes in 1.46.1

| New Item | Details |
| --- | --- |
| Security | Update to Electron v22.3.25 with patch for [CVE-2023-5217](https://github.com/advisories/GHSA-qqvq-6xgj-jw8g) |

For details about the issue addressed in the September 2023 hotfix release, visit the [September 2023 Hotfix Release on GitHub](https://github.com/microsoft/azuredatastudio/milestone/106?closed=1).

For a list of the current known issues, visit the [issues list on GitHub](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue).

## September 2023 

Azure Data Studio 1.46.0 is the latest general availability (GA) release.

- Release number: 1.46.0
- Release date: September 20, 2023

### What's new in 1.46.0

| New Item | Details |
| --- | --- |
| Attach/Detach Database | Introduced support for attaching and detaching databases (Preview) |
| Connection | Introduced support for custom cloud providers, see ([Azure Data Studio - Azure Connectivity](https://learn.microsoft.com/sql/azure-data-studio/azure-connectivity?#configuring-custom-cloud-endpoints)) for configuration information |
| Connection | Enabled Connection Pooling as default behavior |
| Connection | Introduced command `SQL Server: Clear Pooled Connections` to clear inactive pooled connections |
| Database Properties | Introduced support for viewing database properties (Preview) |
| General | Added support for Server and Database properties (Preview) |
| Result Set | Updated copy notification to automatically close after three (3) seconds, and included an option to disable notifications |
| Result Set | Added a prompt to open the file location  after saving result to Excel |
| Profiler Extension | Introduced a progress dialog when opening an XEL file |
| Server Properties | Introduced support for viewing server properties (Preview) |
| SQL Database Projects Extension | Released version 1.3.1 |
| SQL Database Projects Extension | Added support for "Azure Synapse Serverless SQL Pool” target platform |
| SQL Database Projects Extension | Added support for “Synapse Data Warehouse in Microsoft Fabric” target platform |
| SQL Database Projects Extension | Updated to Microsoft.Build.Sql SDK version to 0.1.12-preview |

### Bug fixes in 1.46.0

| New Item | Details |
| --- | --- |
| Accessibility | Improved screen reader prompts for SQL Database Projects extension, Database Migration Assessment for Oracle extension, SQL Agent extension, and when installing a new extension |
| Accessibility | Addressed issues with install button tool tip, new connection button, and new server group buttons |
| Accessibility | Fixed color contrast for creating connections and notebooks, running queries, and deploying a server |
| Connection | Added refresh prompt for Azure accounts when error AADSTS700082 occurs |
| Connection | Introduced notification when a duplicate connection exists upon dragging a connection to a different group |
| Connection | Fixed issue to prevent Dashboard server name from being replaced with profile name |
| Connection | Added retry logic to wait for resume when establishing connection to a serverless Azure database |
| Connection | Fixed issue where tab color did not align with server group color |
| Connection | Updated Cluster Server connection property to have the correct Boolean value for Cosmos DB |
| Connection | Fixed issue with advanced connection options not correctly transferred to change password dialog |
| Connection | Addressed incorrect label for first connection in the Recent connections list |
| Connection | Improved account selection experience after enabling cloud settings |
| General | Fixed issue with incorrect cell colors when editing data |
| General | Addressed problem with invalid data for a column's data type when editing data |
| General | Re-enabled full screen toggle behavior for the F11 key binding |
| Notebooks | Addressed issue where kernel failed to change correctly when switching to Python |
| Query Editor | Fixed Intellisense refresh behavior |
| Query Editor | Improved query execution performance |
| Query Editor | Improved read performance for large data sets |
| Query Editor | Addressed issue where selecting Cancel would not immediately cancel a query that was executing |
| Query Editor | Resolved problem of queries hanging when executing against Synapse Dedicated Pool |
| Query Plan Viewer | Fixed issue where missing index definition recommendation included incorrect column |
| Query Plan Viewer | Addressed issue with query plan XML having the incorrect format |
| Result Set | Corrected XML formatting when opening a column from the result set |
| Result Set | Fixed issue where copying results to clipboard did not work |
| Schema Compare | Added support to automatically resize the split view when the window changes size |
| Schema Compare | Addressed error “StartIndex cannot be less than zero” which occurred when applying change using Schema Compare |
| Schema Compare | Display 'Yes' button to re-compare after changing options in Schema Compare |
| SQL Database Projects | Fixed issue where databases were not populated if a project was created from the server instead of a database |
| SQL Database Projects | Addressed error 'Could not run the "SqlModelResolutionTask" task because MSBuild could not create or connect to a task host with runtime "NET" and architecture "arm64"' resulting in build failure on arm64 with SDK-style and legacy style projects |
| Welcome Page | Improved display of Install button under the extension list on Welcome Page |

For a full list of bug fixes addressed for the September 2023 hotfix release, visit the [September 2023 Release on GitHub](https://github.com/microsoft/azuredatastudio/milestone/102?closed=1).

For a list of the current known issues, visit the [issues list on GitHub](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue).

## July 2023 (Hotfix)

Azure Data Studio 1.45.1 is the latest general availability (GA) release.

- Release number: 1.45.1
- Release date: August 7, 2023

### Bug fixes in 1.45.1

| New Item | Details |
| --- | --- |
| Connection | Fixed an issue that prevented all connections from appearing in the server tree view. |
| Connection | Updated recent connections list to include connections that are not saved. |
| Database Migration Assessment for Oracle | Resolved issue where links to open the assessment output were no longer working. |
| Database Schema Conversion Toolkit | Resolved issue where links to open the conversion output were no longer working. |
| Installation | Addressed error "gyp WARN install" for Windows arm64. |
| Profiler | Fixed an issue where the session dropdown was not populated when an XEL file is opened. |
| Profiler | Addressed issue where running state was incorrectly set after a session was started. |

For a full list of bug fixes addressed for the July 2023 hotfix release, visit the [July 2023 Hotfix Release on GitHub](https://github.com/microsoft/azuredatastudio/milestone/104?closed=1).

### Known issues in 1.45.1

 New Item | Details | Workaround |
| --- | --- | --- |
| Installation | Azure Data Studio installation fails on RHEL 8 | Use RHEL 9, or manually install glibc-2.29 and add it to the Library Path and then re-install ADS |

## July 2023

Azure Data Studio 1.45.0 is the latest general availability (GA) release.

- Release number: 1.45.0
- Release date: July 26, 2023

### What's new in 1.45.0

| New Item | Details |
| --- | --- |
| Connection | Introduced support for Tenant hierarchy in the Azure tree |
| Connection | Updated Azure tree icons |
| Connection | Updated the Azure tree in the Connection Pane to show only available resource types |
| Connection | Added Azure Postgres Flexible Server and Azure CosmosDB for PostgreSQL in the Azure resource tree |
| Connection | Added support for advanced connection options for other providers |
| Connection | Added capability to clear encryption keys with the 'Clear Azure Account Token Cache' command |
| Connection | Introduced support for connection pooling for MSSQL connections |
| GitHub Copilot | GitHub Copilot extension version 1.95.239 |
| MySQL Extension | General Availability |
| Object Explorer | Added support for additional Filter options in Object Explorer |
| Object Explorer | Reduced size of server group color block |
| Object Explorer | Enabled 'Async Server tree' for the Server tree view |
| Object Explorer | Added inline actions (e.g. edit, delete, refresh) |
| Object Explorer | Introduced an action to collapse all open objects in Object Explorer |
| Object Explorer | Added ability to use left and right arrows in OE to open or close trees |
| Object Explorer | Right-click menu options updated and order modified |
| Profiler / Extended Events | Introduced support for opening .XEL files up to 1GB in size |
| Query Editor | Introduced a new configuration option to control whether to add a line break between rows when copying if the previous row has a trailing line break |
| Result Set | Introduced keyboard shortcut (Ctrl/CMD + Shift + C) to copy information from the results grid with headers |
| Result Set | Introduced keyboard shortcut (Ctrl/CMD + Shift + O) to sort columns in a result set |
| SQL Database Projects Extension | Added the ability to create a publish profile from the Add Item… menu |
| Table Designer | Added configuration option to prevent DDL triggers from being disabled as part of the table modification |
| User Management | Improved table component performance in the Securables dialog of User properties |
| VS Code merge | VS Code merges to version 1.79, read [their release notes](https://code.visualstudio.com/updates/v1_79) to learn more |

### Bug fixes in 1.45.0

| New Item | Details |
| --- | --- |
| Accessibility | Improved contrast for buttons on Welcome page when using light themes |
| Accessibility | Improved focus on Home tab when using High Contrast Aquatic/Desert theme |
| Accessibility | Corrected border color the issue reporter dialog when using light theme |
| Accessibility | Fixed multiple issues with screen readers |
| Accessibility | Improved keyboard navigation in select database dropdown and added visual label |
| Accessibility | Added required indicator for Server group name when configuring a server group |
| Accessibility | Fixed display so contents are visible at 200% zoom in Notebook cell |
| Accessibility | Added tooltip for Learn more button in New Deployment window |
| Backup/Restore | Addressed issue with backup/restore dialog titles not updating for non-MSSQL databases |
| Central Management Servers Extension | Resolved error generated after saving a connection using SQL authentication |
| Charting | Addressed issue with mix/max value setting for a chart axis |
| Connection | Improved dialog window for adding an Azure account when authentication code is required |
| Connection | Fixed throttling of ARM requests when in the Browse Connections tab |
| General | Fixed issue with vertical scrolling in dialog windows |
| General | Fixed error "Cannot read properties of undefined" |
| Notebooks | Addressed inability to open JSON in a new tab from Notebook results cell |
| Notebooks | Fixed error "Unable to load and parse grammar for scope markdown.math.inline" when creating a Notebook text cell |
| Object Explorer | Addressed connection leak which occurred when renaming a table |
| Object Explorer | Improved error handling in server tree expand requests |
| Object Explorer | Fixed issue with unexpected connection drops in Object Explorer |
| Query Editor | Corrected syntax highlighting for nested multi-line comments |
| Query Editor | Addressed issue where folding behavior incorrectly included blank lines at the end of a text block |
| Query Editor | Resolved issue when executing USE DATABASE_NAME command and database context did not change in the status bar |
| Query Plan Viewer | Fixed issue with filter icon appearing over query text in Top Operations window |
| Result Set | Fixed issue where HTML entered in Edit Rows mode was being rendered |
| Result Set | Fixed incorrect aggregation (sum) when selecting rows in the result set and implemented performance improvements |
| Result Set | Improved support for copying large result sets to the clipboard |
| Result Set | Added progress notification when copying result sets and implemented performance improvements |
| Result Set | Improved formatting and result set navigation for columns containing XML |
| Result Set | Added notification to identify when the number of rows or columns copied exceed Excel limits |
| SQL Database Projects Extension | Addressed issue with schema compare dropping constraints |
| SQL Database Projects Extension | Removed incorrect delete command from database references node |
| SQL Database Projects Extension | Introduced ability to add sqlcmd variables without a default value via the quickpick |
| User Management | Removed unsupported database roles for Azure SQL DB user creation |
| User Management | Included MUST_CHANGE option for Azure SQL when creating a new login or for a password change |

### Known issues in 1.45.0

 New Item | Details | Workaround |
| --- | --- | --- |
| Installation | Azure Data Studio installation fails on RHEL 8 | Use RHEL 9, or manually install glibc-2.29 and add it to the Library Path and then re-install ADS |

## May 2023 (hotfix)

Azure Data Studio 1.44.1 is the latest general availability (GA) release.

- Release number: 1.44.1
- Release date: June 5, 2023

### Bug fixes in 1.44.1

| New Item | Details |
| --- | --- |
| Backup & Restore | Fixed an issue in Object Explorer where the Restore dialog failed to open. https://github.com/microsoft/azuredatastudio/issues/23257 |
| Connection | Resolved issue that caused a login failure in Azure SQL for hyphenated user accounts. https://github.com/microsoft/azuredatastudio/issues/23210 |
| Object Explorer | Addressed inability to open a view using CTRL/CMD + Q or the Open View menu. https://github.com/microsoft/azuredatastudio/issues/23236 |
| Query Editor | Introduced a performance improvement in the Query Editor language service by enabling connection pooling. https://github.com/microsoft/azuredatastudio/issues/22970 |

## Version 1.44.0

Azure Data Studio 1.44.0 is the latest general availability (GA) release.

- Release number: 1.44.0
- Release date: May 24, 2023

### What's new in 1.44.0

| New Item | Details |
| --- | --- |
| Connection | Enabled Sql Authentication Provider by default for Azure SQL connections and the MSAL Authentication Library.  Learn more at [Connect with Azure Data Studio](https://aka.ms/azuredatastudio-connection) |
| Connection | Introduced support for passing in advanced connection options in command line arguments |
| Connection | Added ability to provide an Application Name in the connection string parameter |
| General | Added support for customizing table keyboard shortcuts |
| General | Added warning notification on startup if Azure PII logging is enabled |
| GitHub Copilot | GitHub Copilot extension for autocomplete-style suggestions added to extension gallery. Learn more at https://aka.ms/ads-copilot |
| Notebooks | Fixed issue where deleted text listed using the Find feature |
| Object Explorer | Introduced filtering capability for Object Explorer (preview) |
| Query Editor | Shorted text for Change Connection and Export as Notebook button |
| Query Results | Increased the default max column width |
| SQL Database Projects Extension | Released version 1.1.1 |
| SQL Database Projects Extension | Improved performance of loading one or more large projects |
| SQL Database Projects Extension | Introduced ability to save publish settings to a new or existing  publish profile |
| User Management | Added support for creating database and server roles (preview) |
| User Management | Improved authentication options when creating database users (preview) |

### Bug fixes in 1.44.0

| New Item | Details |
| --- | --- |
| Accessibility | Added labels to radio groups in SQL Database Projects dialog |
| Accessibility | Fixed issue with narrator reading character twice in network share path for Azure SQL migration extension |
| Accessibility | Addressed problem where keyboard focus did not shift to error message when creating a new database |
| Accessibility | Fixed issue with voiceover not announcing label names correctly when updating a database project |
| Connection | Improved token refresh behavior |
| Connection | Enabled support to login with blank passwords when creating MSSQL connection |
| Connection | Added change password dialog display after password expiration occurs for a SQL login |
| Connection | Addressed scenario where Intellisense stopped working after a connection token expired |
| Connection | Fixed behavior where PostgreSQL username was incorrectly replaced |
| Connection | Implemented support for connections against the same server but with different properties |
| Connection | Resolved issue where connection status changed to red (disconnected) after moving an active connection to a server group |
| Connection | Updated Azure node in Connection dialog to include notation when no subscriptions are found |
| Connection | Updated firewall dialog to pre-select the account and tenant in the connection dialog |
| Extension | Fixed an issue with over-encoded URLs in diagnostic error messages |
| Intellisense | Resolved issue with SORT_IN_TEMPDB not recognized as valid T-SQL syntax when creating an object |
| Notebooks | Updated Notebook connection to support MySQL and PostgreSQL when connecting to an existing Notebook |
| Query Results | Fixed overlapping action display when multiple result sets are returned |
| Schema Compare | Update scmp files to be backwards compatible |
| SQL Database Projects Extension | Fixed multiple issues related to SQLCMD variables and projects |
| SQL Database Projects Extension | Addressed a failure that was occurring when using schema compare with Azure Synapse dedicated pools |
| SQL Database Projects Extension | Resolved problem where a database project would not build after a reference to a system database was added from SSDT |
| SQL Database Projects Extension | Fixed issue where projects were listed twice when using multi root workspaces |
| SQL Database Projects Extension | Fixed an issue where file structure information was not stored in the scmp file after a schema compare |
| SQL Database Projects (VS Code) | Updated default folder location when creating a new project from database workflow |

For a full list of bug fixes addressed for the May 2023 release, visit the [May 2023 Release on GitHub](https://github.com/microsoft/azuredatastudio/milestone/98?closed=1).

## Version 1.43.0
* Release number: 1.43.0
* Release date: April 12, 2023

### What's new in 1.43.0

| New Item | Details |
| --- | --- |
| Connection | Added notation for required properties (e.g. Attestation protocol and Attestation URL) when Secure Enclaves are enabled |
| SQL Database Projects extension | General Availability |
| SQL Database Projects extension | Move and rename files within Database Projects view |
| SQL Database Projects extension | SQLCMD variables available for editing in Database Projects view |
| Object Explorer | Double-clicking on a user or table in Object Explorer will open the designer for the object |
| Query Editor | Added a Parse button to the Query Editor toolbar for parsing queries before execution |
| Query Results | Added support to select a row in query results via double click |

### Bug fixes in 1.43.0

| New Item | Details |
| --- | --- |
| Connection | Added support for linked accounts with same username but different domains |
| Connection | Fixed issue with incorrect cache write path |
| Connection | Added ability to include optional name and grouping when creating a new connection using a connection string |
| Connection | Updating username in MSSQL connections to use Preferred username for the display name |
| Connection | Fixed issue with encoding for OSX keychain on macOS |
| Connection | Added support for Azure MFA and ‘Sql Authentication Provider’ on Linux |
| Dataverse | Addressed error generated when expanding the database node for a Dataverse database in Object Explorer |
| IntelliCode extension | Fixed error that occurred when launching Azure Data Studio with Visual Studio Code IntelliCode extension installed |
| PostgreSQL extension | Implemented support for exporting query results on Apple M1 from a notebook |
| SQL Database Projects extension | Added Accessibility Fixes related to screen reader, label names, and improved focus when navigating |

For a full list of bug fixes addressed for the April 2023 release, visit the [April 2023 Release on GitHub](https://github.com/microsoft/azuredatastudio/milestone/99?closed=1).

## Version 1.42.0
* Release number: 1.42.0
* Release date: March 22, 2023

### What's new in 1.42.0

| New Item | Details |
| --- | --- |
| ARM64 Support for macOS | Implemented native arm64 SqlToolsService support for arm64 Windows and macOS. |
| Connection | Changed the icon under Linked Accounts when adding a new Azure account. |
| Connection | Introduced support for the Command Timeout connection property. |
| Connection | Added support for all three connection encryption options: Strict, Mandatory, and Optional. |
| Connection | Introduced HostNameInCertificate connection property under Security on the Advanced tab, for server with a certificate configured. |
| Connection | Added new advanced option in the Connection dialog to support Secure Enclaves. |
| Connection | Introduced a new setting, Mssql Enable Sql Authentication Provider to allow connections to be maintained without the concern of losing access token lifetime or getting dropped by server. Access tokens will be refreshed internally by the SqlClient driver whenever they are found to be expired.  This option is disabled by default.  |
| Connection | Added support for connections to Microsoft Dataverse using the TDS endpoint. |
| Connection | Introduced additional error reporting for Azure connections. |
| Connection | Introduced support for change password. |
| Connection | Added support for encryption options for Arc SQL Managed Instance when server certificates are not installed. |
| Deployment | Moved the New Deployment option from the Connections breadcrumb to the File Menu. |
| Object Explorer | Introduced ability to group objects in Object Explorer by database schema.  This applies to all MSSQL connections when enabled or disabled. |
| Object Explorer | Introduced a new option to allow a custom timeout to be configured for Object Explorer.  Within Settings, enable Mssql > Object Explorer: Expand Timeout. |
| Query Results | Added option to disable special handling for JSON strings. |

### Bug fixes in 1.42.0

| New Item | Details |
| --- | --- |
| Accessibility	| Updated server group color display to improve visibility and contrast. |
| Backup | Addressed inability to select "Backup Set" checkbox. |
| Connection | Removed refresh action for connections which are disconnected. |
| Connection | Fixed issue with MSAL not properly set for connections. |
| Connection | Added ability to delete a server group if no connections exist for it. |
| Connection | Added connection display name to the Delete Connection dialog. |
| Connection | Azure connections with "Do not save" for the server group are no longer added to the default server group list. |
| Connection | Improved error handling in the connection dialog. |
| Connection | Fixed issue where saved passwords were not retained for Azure SQL connections. |
| Connection | Improved method to retrieve database access when connecting to Azure SQL. |
| Connection | Improved connection experience for cloud users. |
| Connection | Improved account and tenant selection when connecting to Azure SQL in the connection dialog. |
| Deployment | Improved narration for deployment wizard. |
| Installation | Updated default install location for the Windows on ARM installer. |
| MySQL Extension | Addressed issue where dialog boxes in the MySQL connection pane were not editable. |
| Notebooks | Fixed issue with updating the relative path in a Notebook cell. |
| Notebooks | Fixed issue that caused internal notebook links to break when editing characters in the page. |
| Notebooks | Addressed error thrown when opening a Notebook via a link. |
| Object Explorer | Fixed issue with Object Explorer node not expanding. |
| Query Editor | Fixed database dropdown list for contained users to display correctly. |
| Query Editor | Addressed issue where database dropdown list was not ordered the same as in Object Explorer. |
| Query Editor | Added the ability to properly escape special characters when they exist in object names. |
| Query Editor | Fixed issue which caused query timer to continue to run even though execution was complete. |
| Query Plan Viewer | Addressed an issue where a query plan would not render when opened via a URL. |
| Query Results | Improved precision formatting for datetimeoffset data type. |

For a full list of bug fixes addressed for the March 2023 release, visit the [bugs and issues list on GitHub](https://github.com/microsoft/azuredatastudio/milestone/95?closed=1).

#### Known issues

For a list of the current known issues, visit the [issues list on GitHub](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue).

## Version 1.41.2
* Release date: February 10, 2023
* Release status: General Availability

### Bug fixes in 1.41.2

| New Item | Details |
| --- | --- |
| Connection | Fixed a regression blocking connections to sovereign Azure clouds |
| Query Editor | Fixed a regression causing the Output window to display on each query execution |

## Version 1.41.1
* Release date: January 30, 2023
* Release status: General Availability

### Bug fixes in 1.41.1

| New Item | Details |
| --- | --- |
| Connection | Fixed a bug causing incorrect Azure account tenant selection when connecting to server through Azure view |
| Object Explorer | Fixed a regression causing Object Explorer to not show database objects for Azure SQL DB Basic SLO |

## Version 1.41.0
* Release date: January 25, 2023
* Release status: General Availability

### What's new in 1.41.0

| New Item | Details |
| --- | --- |
| Azure Subscriptions |  Introduced Azure Synapse Analytics and Dedicated SQL Pools nodes. |
| Azure SQL Migration Extension | Premium series memory optimized SQL MI SKUs included in recommendations. |
| Connection | Migrated Azure authentication library from ADAL to MSAL. MSAL is the library used by default starting with release 1.41.  However, if you encounter issues, you can change back to ADAL within **Settings > Azure: Authentication Library**.  |
| Connection | Added ability to provide a description when creating a firewall rule from Azure Data Studio. |
| Connection | Include ability to change password for new or expired login. |
| Connection | Add support for SQL Server Alias use when connecting to a server. |
| MongoDB Atlas Extension | Provides the ability to connect to and query data on MongoDB Atlas (Preview). |
| Notebooks | Provide option for users to convert markdown to a table or not when HTML table tag is present. |
| Object Explorer | Databases are no longer brought online in serverless Azure SQL when Databases node is expanded. |
| Object Explorer | Added support for Ledger views. |
| Object Explorer | Fixed issue with key binding for objectExplorer.manage not working. |
| Query Editor | Fixes and updates to SQL grammar (colorization and auto-complete). |
| Query Plan Viewer | Changed default folder to be user’s home directory when saving a query plan. |
| Query Results | Added ability to only copy Column Headers, and only for cells that are highlighted. |
| Query Results | Added option to show or hide the action bar in the results window. |
| Query Results | Increased height of horizontal scrollbar in results window. |
| Query Results | Added new aggregate details in the results toolbar when selecting multiple cells. |
| SQL Projects Extension | Provide the ability select an existing project via a new dropdown. |

### Bug fixes in 1.41.0

| New Item | Details |
| --- | --- |
| Accessibility | Accessibility improvements were made in the Query Plan Viewer, Query History Extension and Migration Extension. |
| Big Data Cluster | Fix missing connect icon in BDC view header bar. |
| Big Data Cluster | Fixed issue preventing HDFS nodes for BDC servers in Object Explorer from expanding. |
| Connection | Added ability to delete a connection that has expired AAD credentials. |
| Connection | Improved experience when Azure Active Directory token expiration occurs. |
| Connection | Improved connection experience when using multiple Azure tenants. |
| Connection | Addressed problem with adding a firewall exception for a non-default Azure subscription. |
| Migration Extension | Added support for non-public clouds for migration scenarios. |
| MySQL Extension | Updated resource endpoints to support AAD logins in the MySQL extension. |
| Notebooks | Improve Intellisense refresh in Notebook cells. |
| Notebooks | Address issue with "New Notebook Job" resulting in an empty form. |
| Object Explorer | Fixed issue with database list not loading. |
| Query Execution | Fixed error generated when executing a query with LEFT JOIN and NULL values. |
| Query Plan Viewer | When saving query plans (.sqlplan file), the filename will numerically increment to prevent duplicate filenames. |
| Query Results | Fixed issue where users were unable to open JSON data as a new file. |
| Query Results | Provide proper cell selection and navigation in the query results grid. |
| Query Results | Improved the handling of line breaks when copying cell contents. |
| Query Results | Addressed issue where a column would re-size incorrectly when auto-sizing in the results output. |
| Query Results | Improved JSON cell handling from query results. |
| Query Results | Fixed behavior where focus was incorrectly set on a cell using keyboard navigation. |
| Resource Deployment | Remove 'Preview' flag for SQL Server 2022 deployment types. |
| Schema Compare Extension | Fixed problem where differences in schema compare were not being highlighted. |
| Schema Compare Extension | Permissions are now included in schema compare when the "Include Permissions" option is selected. |
| SQL Projects Extension | Changes to db_datawriter or db_datareader roles are now supported. |
| SQL Projects Extension | Updated Database Projects Net Core SDK Location dialog to be more descriptive. |
| Table Designer | Updated Table Designer to disable transaction support for Azure Synapse databases. |
| Table Designer | Addressed problem of the table name not refreshing after being updated prior to publishing. |
| Table Designer | Fixed issue where table designer could not be opened for existing Ledger tables. |

## Version 1.40.2
* Release date: December 27, 2022
* Release status: General Availability

### Bug fixes in 1.40.2
  * Fix potential elevation of privilege issue using Bash shell on Windows.  VS Code issue [#160827](https://github.com/microsoft/vscode/issues/160827)

## Version 1.40.1
* Release date: November 22, 2022
* Release status: General Availability

### Bug fixes in 1.40.1
  * Fixed bug that caused folders in the servers tree to display incorrect contents [#21245](https://github.com/microsoft/azuredatastudio/issues/21245)

## Version 1.40.0
* Release date: November 16, 2022
* Release status: General Availability
### What's new in 1.40.0
| New Item | Details |
|----------|---------|
| Connections | Connections for SQL now default to Encrypt = 'True'. |
| ARM64 Support for macOS | ARM64 build for macOS is now available.  |
| Table Designer | Announcing the General Availability of the Table Designer. |
| Table Designer | Period columns now added by default when System-Versioning table option is selected. |
| Table Designer | Added support for hash indexes for In-Memory tables, and added support for columnstore indexes. |
| Table Designer | New checkbox added, "Preview Database Updates", when making database changes to ensure that users are aware of potential risks prior to updating the database.|
| Table Designer | "Move Up" and "Move Down" buttons added to support column reordering for Primary Keys. |
| Query Plan Viewer | Announcing the General Availability of the Query Plan Viewer in Azure Data Studio. |
| Query Plan Viewer | Added support for identification of most expensive operator(s) in a plan. |
| Query Plan Viewer | Updates were made to the properties window to allow for full display of text upon hovering over a cell. Full text can also be copied. |
| Query Plan Viewer | Implemented filter functionality in the Properties pane for an execution plan. |
| Query Plan Viewer | Added support for collapsing and expanding all subcategories within the Plan Comparison Properties window. |
| Query History Extension | Announcing the General Availability of the SQL History Extension. |
| Query History Extension | Now includes ability to persist history across multiple user sessions. |
| Query History Extension | Added the ability to limit the number of entries stored in the history. |
| Schema Compare | Users can now open .scmp files directly from the context menu for existing files in the file explorer. |
| Query Editor | Now allows full display for text strings larger than 65,535 characters. |
| Query Editor | Added support for the SHIFT key when making multiple cell selections.  |
| MySQL Extension | Support for MySQL extension is now available in preview. |
| Azure SQL Migration Extension | Azure SQL Database Offline Migrations is now available in preview. Customers can use this new capability to save and share reports as needed. |
| Azure SQL Migration Extension | Addition of elastic Azure recommendations model. |
| Database Migration Assessment for Oracle | Assessment tooling for Oracle database migrations to Azure Database for PostgreSQL and Azure SQL available in preview. |
| VS Code merge | VS Code merges to version 1.67. Read [their release notes](https://code.visualstudio.com/updates/v1_67) to learn more. |
| SQL Database Projects | Adds SQL projects support for syntax introduced in SQL Server 2022.|

### Bug fixes in 1.40.0
| New Item | Details |
|----------|---------|
| Connections | Fixed bug that occurred when trying to connect to the Dedicated Admin Connection (DAC) on SQL Server. |
| Connections | Fixed issue with wrong tenant showing up while trying to connect to a database with Azure Active Directory login. |
| Connections | Fixed zoom reset behavior when adding a new connection. |
| Connections | Fixed loading bug what occurred when attempting to sign in to Azure via proxy. |
| Connections | Fixed issue encountered while attempting to connect to a "sleeping" Azure SQL Database. |
| Object Explorer | Fixed the SELECT script generation issue for Synapse Databases. |
| Schema Compare | Fixed error that caused duplication of comment headers when applying schema changes on stored procedure objects. |
| Schema Compare | Fixed issue that prevented schema compare issues when creating a new empty schema with a "DOMAIN\User" pattern. |
| Query Editor | Fixed bug that caused results to be lost upon saving query files. |
| Table Designer | Fixed a bug that caused creation of a new table when renaming an existing table. |
| Query Plan Viewer | Fixed missing index recommendation T-SQL syntax. |
| SQL Projects | Fixed bug in SQL Projects that led to extension not using output path when publishing a project. |
| SQL Projects | Fixed bug that caused .NET install to not be found when using the SQL Projects extension on Linux platforms. |

## Version 1.39.1
* Release date: August 30, 2022
* Release status: General Availability

### Bug fixes in 1.39.1
  * Fixed bug that caused Database Trees in server connections to not expand in the Object Explorer.

## Version 1.39.0
* Release date: August 24, 2022
* Release status: General Availability
### What's new in 1.39.0
* New Features:
    * Deployment Wizard - Azure Data Studio now supports SQL Server 2022 (Preview) in the Deployment Wizard for both local and container installation.
    * Object Explorer - Added Ledger icons and scripting support to Object Explorer for Ledger objects.
    * Dashboard - Added hexadecimal values to support color detection.
    * Query Plan Viewer - Added the ability to copy text from cells in the Properties Pane of a query plan.
    * Query Plan Viewer - Introduced a "find node" option in plan comparison to search for nodes in either the original or added plan.
    * Table Designer - Now supports the ability to add included columns to a nonclustered index, and the ability to create filtered indexes.
    * SQL Projects - Publish options were added to the Publish Dialog.
    * Query History Extension - Added double-click support for query history to either open the query or immediately execute it, based on user configuration.

* Bug Fixes:
    * Dashboard - Fixed an accessibility issue that prevented users from being able to access tooltip information using the keyboard.
    * Voiceover - Fixed a bug that caused voiceover errors across the Dashboard, SQL Projects, SQL Import Wizard, and SQL Migration extensions.
    * Schema Compare - Fixed a bug that caused the UI to jump back to the top of the options list after selecting/deselecting any option.
    * Schema Compare - Fixed a bug involving Schema Compare (.SCMP) file incompatibility with Database Project information causing errors when reading and using information stored in this file type.
    * Object Explorer - Fixed a bug that caused menu items in Object Explorer not to show up for non-English languages.
    * Table Designer - Fixed a bug that caused the History Table name not to be consistent with the current table name when working with System-Versioned Tables.
    * Table Designer - Fixed a bug in the Primary Key settings that caused the "Allow Nulls" option to be checked, but disabled, preventing users from changing this option.
    * Query Editor - Fixed a bug that prevented the SQLCMD in T-SQL from working correctly, giving false errors when running scripts in Azure Data Studio.
    * Query Editor - Fixed a bug that caused user-specified zoom settings to reset to default when selecting JSON values after query that returned JSON dataset was ran.
    * SQL Projects - Fixed a bug that caused the "Generate Script" command to not work correctly when targeting a new Azure SQL Database.
    * Notebooks - Fixed a bug that caused pasted images to disappear from editor after going out of edit mode.
    * Notebooks - Fixed a bug that caused a console error message to appear after opening a markdown file.
    * Notebooks - Fixed a bug that prevented markdown cell toolbar shortcuts from working after creating a new split view cell.
    * Notebooks - Fixed a bug that caused text cells to be erroneously created in split view mode when the notebook default text edit mode was set to "Markdown".

## Version 1.38.0
* Release date: July 27, 2022
* Release status: General Availability
### What's new in 1.38.0
* New Features:
    * VS Code merges to 1.62 - This release includes updates to VS Code from the three previous VS Code releases. Read [their release notes](https://code.visualstudio.com/updates/v1_62) to learn more.
    * Table Designer - New column added to Table Designer for easier access to additional actions specific to individual rows.
    * Query Plan Viewer - The Top Operations pane view now includes clickable links to operations in each of its rows to show the runtime statistics which can be used to evaluate estimated and actual rows when analyzing a plan.
    * Query Plan Viewer - Improved UI on selected operation node in the Execution Plan.
    * Query Plan Viewer - The keyboard command **CTRL + M** no longer executes queries. It now just enables or disables the actual execution plan creation when a query is executed.
    * Query Plan Viewer - Plan labels are now updated in the Properties window when plans are compared and the orientation is toggled from horizontal to vertical, and back.
    * Query Plan Viewer - Updates were made to the Command Palette. All execution plan commands are prefixed with "Execution Plan", so that they are easier to find and use.
    * Query Plan Viewer - A collapse/expand functionality is now available at the operator level to allow users to hide or display sections of the plan during analysis.
    * Query History - The Query History extension was refactored to be fully implemented in an extension. This makes the history view behave like all other extension views and also allows for searching and filtering in the view by selecting the view and typing in your search text.

* Bug Fixes:
    * Table Designer - Error found in edit data tab when switching back to previously selected column when adding a new row. To fix this, editing the table is now disabled while new rows are being added and only reenabled afterwards.
    * Query Editor - Fixed coloring issues for new T-SQL functions in the Query Editor.
    * Query Plan Viewer - Fixed bug that caused custom zoom level spinner to allow values outside valid range.
    * Dashboard - Fixed issue that caused incorrect displaying of insight widgets on the dashboard.
    * Notebooks - Fixed issue where keyboard shortcuts and toolbar buttons were not working when first creating a Split View markdown cell.
    * Notebooks - Fixed issue where cell languages were not being set correctly when opening an ADS .NET Interactive notebook in VS Code.
    * Notebooks - Fixed issue where notebook was being opened as empty when exporting a SQL query as a notebook.
    * Notebooks - Disables install and uninstall buttons in Manage Packages dialog while a package is being installed or uninstalled.
    * Notebooks - Fixed issue where cell toolbar buttons were not refreshing when converting cell type.
    * Notebooks - Fixed issue where notebook was not opening if a cell contains an unsupported output type.
    * Schema Compare - Fixed issue where views and stored procedures were not correctly recognized by schema compare after applying changes.

## Version 1.37.0
* Release date: June 15, 2022
* Release status: General Availability
### What's new in this version
* New Features:
    *  Backup & Restore - Backup & Restore to URL is now available in preview for Azure SQL Managed Instances.
    *  Table Designer - Added API to support computed column capabilities on Table Designer.
    *  Table Designer - Can now specify where to add new columns and columns can now be re-arranged by mouse dragging.
    *  Table Designer - Table Designer is now supported by SQL Projects to add or modify database schema without need to be connected to a server instance.
    *  Query Plan Viewer - Smart plan comparison is now available. Can now compare execution plans and view detailed differences between plans in the Properties Table.
    *  Query Plan Viewer - Added toggle button to switch between estimated and actual execution plans.
    *  Query Plan Viewer - Query Plan now comes with improved precision to operator costs for larger plans.
    *  MongoDB Extension for Azure Cosmos DB (Preview) - This extension introduces support for access to Mongo resources for Cosmos DB.

* Bug Fixes:
    *  Table Designer - Fixed issue that caused app to not prompt user to save before closing.
    *  Table Designer - Fixed issue that returned empty data set upon attempting to edit the first cell of a new row.
    *  Table Designer - Improved resize to fit experience when zooming in on user interface as well as tab behavior issues.
    *  Query Plan Viewer - Fixed bug that caused custom zoom level spinner to allow values outside valid range.
    *  Schema Compare - Fixed issue with indexes not being added correctly when updating project from database.
    *  Notebooks - Fixed inconsistencies with notebook cell behavior and toolbars.
    *  Notebooks - Fixed issues with keyboard navigation.

## Version 1.36.2
* Release date: May 20, 2022
* Release status: General Availability
### What's new in this version
- Fix connectivity issue with PBI data source
- Fix query plan zoom and icon issues
- Issues fixed in this release https://github.com/microsoft/azuredatastudio/milestone/89?closed=1

## Version 1.36.1
* Release date: April 22, 2022
* Release status: General Availability
### What's new in this version
* April Hotfix addressing these issues https://github.com/microsoft/azuredatastudio/milestone/88?closed=1.
* Hotfix RCA - https://github.com/microsoft/azuredatastudio/wiki/ADS-April-2022-Hotfix-RCA

## Version 1.36.0
* Release date: April 20, 2022
* Release status: General Availability
### What's new in this version
- General Availability of the Azure SQL Migration Extension for ADS
- Support for .NET Interactive Notebooks Extension
- New Table Designer Features including support for System Versioned, Graph and Memory Optomized Tables
- Query Plan Viewer Updates includign warning and parallelism icons, the option to disable tooltips and support for opening .sqlplan files
- Improvements in SQL Projects and Schema Compare

## Version 1.35.1
* Release date: March 17, 2022
* Release status: General Availability
### Hotfix release
- Fix for [Excel number format #18615](https://github.com/microsoft/azuredatastudio/issues/18615)
- Fix for [Geometry Data Type Returned as Unknown Charset in Results Grid #18630](https://github.com/microsoft/azuredatastudio/issues/18630)

## Version 1.35.0
* Release date: February 24, 2022
* Release status: General Availability
### What's new in this version
* New Features:
    *  Table Designer - Added functionality for creation and management of tables for SQL Servers. Built using DacFx framework
    *  Query Plan Viewer - Added functionality for users to view a graphic view of estimated and actual query plans without need for an extension
    *  Azure Arc Extension - Updated the Data Controller deployment wizard and the SQL Managed Instance - Azure Arc deployment wizard to reflect the deployment experience in Azure Portal

* Bug Fixes:
    *  Azure Arc Extension - SQL Managed Instance-Azure Arc is now fixed for both indirect connectivity mode and direct connectivity mode
    *  Notebooks - Support for keyboard navigation between cells to minimize mouse clicking

 ## Version 1.34.0
* Release date: December 15, 2021
* Release status: General Availability
### What's new in this version
* New Features:
    *  Added “Currently restoring backup file” in the migration progress details page of Azure SQL Migration extension when backup files location is Azure Storage blob container
    *  Enhancements to diagnostics in Azure SQL Migration extension
    *  Support for project build with .NET 6 in SQL Database Projects extension
    *  Publish to container in SQL Database Projects extension
    *  Undo and redo support for notebook cell-level operations

* Extension Updates:
    *  Azure SQL Migration
    *  Langpacks
    *  SQL Database Projects

* Bug Fixes:
    *  Fix for multiple database migrations when using network share as backup files location in Azure SQL Migration extension
    *  Fix for multiple database migrations when using blob storage containers as backup files location in Azure SQL Migration extension
    *  Fix to pre-populate target database names in the migration wizard in Azure SQL Migration extension
    *  Fix to column sorting in grids where the presence of null values could lead to unexpected results
    *  Fix for Python upgrades when two or more notebooks were open

## Version 1.33.1
* Release date: Nov 4, 2021
* Release status: General Availability

### Hotfix release
- Fix for [#16535 Unable to See Saved Connections in Restricted Mode](https://github.com/microsoft/azuredatastudio/issues/17535)
- Fix for [#17579 Can't type in Notebook code cell after editing text cell](https://github.com/microsoft/azuredatastudio/issues/17579)

## Version 1.33.0
* Release date: October 27, 2021
* Release status: General Availability
### What's new in this version
* New Notebook Features:
    *  Notebook Views
    *  Split cell support
    *  Keyboard shortcuts for Markdown Toolbar Cells
       * Ctrl/Cmd + B = Bold Text
       * Ctrl/Cmd + I = Italicize Text
       * Ctrl/Cmd + U = Underline Text
       * Ctrl/Cmd + Shift + K = Add Code Block
       * Ctrl/Cmd + Shift + H = Highlight Text
    *  Book improvements
       * Add a new section
       * Drag and Drop

* Extension Updates:
    * Import
    * Langpacks
    * Schema Compare
    * Sql Database Projects

* Bug Fixes
    * Notebook linking improvements
    * Horizontal Scrollbar improvement (when word wrap is off in MD Splitview / MD mode) in Notebooks
    * Vertical Scrollbar improvement for MD Splitview in Notebooks

## Version 1.32.0
* Release date: August 18, 2021
* Release status: General Availability
* Extension Updates:
    * Arc/Az CLI extensions - Azure Arc extension now uses Azure CLI instead of Azure Data CLI for deploying and interacting with Azure Arc
       instances
    *  Langpacks
    *  SQL Database Projects
    *  Azure Monitor
    *  Machine Learning

## Version 1.31.1
* Release date: July 29, 2021
* Release status: General Availability
### Hotfix Release
- Fix for [#16436 Database Connection Toolbar Missing](https://github.com/microsoft/azuredatastudio/issues/16436)

## Version 1.31.0
* Release date: July 21, 2021
* Release status: General Availability
* New Notebook Features:
    * WYSIWYG link improvements
* Extension Updates:
    * Import
    * SandDance
    * SQL Database Projects
* Bug Fixes
  * Accessibility bug fixes

## Version 1.30.0
* Release date: June 17, 2021
* Release status: General Availability
* New Notebook Features:
    * Show book's notebook TOC title in pinned notebooks view
    * Add new book icon
    * Update Python to 3.8.10
* Query Editor Features:
    * Added filtering/sorting feature for query result grid in query editor and notebook, the feature can be invoked from the column headers. Note that this feature is only           available when you enable the preview features
    * Added a status bar item to show summary of the selected cells if there are multiple numeric values
* Extension Updates:
    * SQL Database Projects
    * Machine Learning
* Bug Fixes
  * Fix WYSIWYG Table cell adding new line in table cell

## Version 1.29.0
* Release date: May 19, 2021
* Release status: General Availability
* New Notebook Features:
    * Added runs with a parameters option.
* Extension Updates:
    * SQL Database Projects
    * Schema Compare
* Bug Fixes

## Version 1.28.0
* Release date: April 16, 2021
* Release status: General Availability
* New Notebook Features:
    * Added Add Notebook and Remove Notebook commands
* Extension Updates:
    * SQL Database Projects
    * Schema Compare
* Bug Fixes

## Version 1.27.0
* Release date: March 17, 2021
* Release status: General Availability
* New Notebook Features:
    * Added create book dialog
* Extension Updates:
    * Import
    * Dacpac
    * Machine Learning
    * SQL Assessment
    * Arc
    * SQL Database Projects
    * ASDE Deployment
* Bug Fixes

## Version 1.26.1
* Release date: February 25, 2021
* Release status: General Availability
* Fixes https://github.com/microsoft/azuredatastudio/issues/14382

## Version 1.26.0
* Release date: February 22, 2021
* Release status: General Availability
* Added edit Jupyter book UI support
* Improved Jupyter server start-up time by 50% on windows
* Extension Updates:
    * Azure Arc
        * PG dashboard enhancements
        * Multi-controller support
        * MIAA Dashboard will no longer prompt for SQL Server connection immediately upon opening
    * Azure Data CLI
    * Kusto
    * Machine Learning
    * Profiler
    * Server Reports
    * Schema Compare
    * SQL Server Dacpac
    * SQL Database Projects
* Bug Fixes

## Version 1.25.3
* Release date: February 10, 2021
* Release status: General Availability
* Update Electron to 9.4.3 to incorporate critical upstream fixes

## Version 1.25.2
* Release date: January 22, 2021
* Release status: General Availability
* Fixes https://github.com/microsoft/azuredatastudio/issues/13899

## Version 1.25.1
* Release date: December 10, 2020
* Release status: General Availability
* Fixes https://github.com/microsoft/azuredatastudio/issues/13751

## Version 1.25.0
* Release date: December 8, 2020
* Release status: General Availability
* Kusto extension improvements
* SQL Project extension improvements
* Notebook improvements
* Azure Browse Connections Preview performance improvements
* Bug Fixes

## Version 1.24.0
* Release date: November 12, 2020
* Release status: General Availability
* SQL Project improvements
* Notebook improvements, including in WYSIWYG editor enhancements
* Azure Arc improvements
* Azure SQL Deployment UX improvements
* Azure Browse Connections Preview
* Bug Fixes

## Version 1.23.0
* Release date: October 14, 2020
* Release status: General Availability
* Added deployments of Azure SQL DB and VM
* Added PowerShell kernel results streaming support
* Added improvements to SQL Database Projects extension
* Bug Fixes
* Extension Updates:
    * SQL Server Import
    * Machine Learning
    * Schema Compare
    * Kusto
    * SQL Assessment
    * SQL Database Projects
    * Azure Arc
    * azdata

## Version 1.22.1
* Release date: September 30, 2020
* Release status: General Availability
* Fix bug #12615 Active connection filter doesn't untoggle | [#12615](https://github.com/microsoft/azuredatastudio/issues/12615)
* Fix bug #12572 Edit Data grid doesn't escape special characters | [#12572](https://github.com/microsoft/azuredatastudio/issues/12572)
* Fix bug #12570 Dashboard Explorer table doesn't escape special characters | [#12570](https://github.com/microsoft/azuredatastudio/issues/12570)
* Fix bug #12582 Delete row on Edit Data fails | [#12582](https://github.com/microsoft/azuredatastudio/issues/12582)
* Fix bug #12646 SQL Notebooks: Cells being treated isolated | [#12646](https://github.com/microsoft/azuredatastudio/issues/12646)

## Version 1.22.0
* Release date: September 22, 2020
* Release status: General Availability
* New Notebook Features
    * Supports brand new text cell editing experience based on rich text formatting and seamless conversion to markdown, also known as WYSIWYG toolbar (What You See Is What You Get)
    * Supports Kusto kernel
    * Supports pinning of notebooks
    * Added support for new version of Jupyter Books
    * Improved Jupyter Shortcuts
    * Introduced perf loading improvements
* Added Azure Arc extension - Users can try out Azure Arc public preview through Azure Data Studio. This includes:
    * Deploy data controller
    * Deploy Postgres
    * Deploy Managed Instance for Azure Arc
    * Connect to data controller
    * Access data service dashboards
    * Azure Arc Jupyter Book
* Added new deployment options
    * Azure SQL Database Edge
    * (Edge will require Azure SQL Edge Deployment Extension)
* Added SQL Database Projects extension - The SQL Database Projects extension brings project-based database development to Azure Data Studio. In this preview release, SQL projects can be created and published from Azure Data Studio.
* Added Kusto (KQL) extension - Brings native Kusto experiences in Azure Data Studio for data exploration and data analytics against massive amount of real-time streaming data stored in Azure Data Explorer. This preview release supports connecting and browsing Azure Data Explorer clusters, writing KQL queries as well as authoring notebooks with Kusto kernel.
* SQL Server Import extension GA - Announcing the GA of the SQL Server Import extension, features no longer in preview. This extension facilitates importing csv/txt files. Learn more about the extension in [this article](sql-server-import-extension.md).
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue+milestone%3A%22September+2020+Release%22+is%3Aclosed).

## Version 1.21.0
* Release date: August 12, 2020
* Release status: General Availability
* New Notebook Features
   * Move cell locations changd
   * Added action to convert cells to Text Cell or Code cell
* Jupyter Books picker to open Jupyter Books directly from Github
* Search bar added to Notebooks Viewlet for searching through Jupyter Books
* Address issues in [August 2020 Milestone](https://github.com/microsoft/azuredatastudio/milestone/59?closed=1)

## Version 1.20.1
* Release date: July 17, 2020
* Release status: General Availability
* Fix bug #11372 Object Explorer drag-and-drop table incorrectly wraps table names [#11372](https://github.com/microsoft/azuredatastudio/issues/11372)
* Fix bug #11356 Dark theme is now the default theme [#11356](https://github.com/microsoft/azuredatastudio/issues/11356)
* Known Issues:
    * Some users have reported connection errors from the new Microsoft.Data.SqlClient v2.0.0 included in this release. Users have found [following these instructions](https://github.com/microsoft/azuredatastudio/issues/11367#issuecomment-659614111) to successfully connect. This issue was caused by a client driver update which fixed an issue where TLS encryption wasn't enforced correctly. See https://github.com/dotnet/SqlClient/blob/master/release-notes/2.0/2.0.0.md#breaking-changes-1 and https://docs.microsoft.com/en-us/sql/relational-databases/native-client/features/using-encryption-without-validation for more information.

## Version 1.20.0
* Release date: July 15, 2020
* Release status: General Availability
* Feature Tour
* New Notebook Features
    * Header support in Markdown Toolbar
    * Side-by-side Markdown preview in Text Cells
* Drag and drop columns and tables into Query Editor
* Azure Account icon added to Activity Bar
* Address issues in [July 2020 Milestone](https://github.com/microsoft/azuredatastudio/milestone/57?closed=1)
* Bug fixes

## Version 1.19.0
* Release date: June 15, 2020
* Release status: General Availability
* Address issues in https://github.com/microsoft/azuredatastudio/milestone/55?closed=1
* Bug fixes

## Version 1.18.1
* Release date: May 27, 2020
* Release status: General Availability
* Hotfix for https://github.com/microsoft/azuredatastudio/issues/10538
* Hotfix for https://github.com/microsoft/azuredatastudio/issues/10537

## Version 1.18.0
* Release date: May 20, 2020
* Release status: General Availability
* Announcing Redgate SQL Prompt extension - This extension lets you manage formatting styles directly within Azure Data Studio, so you can create and edit your styles without leaving the IDE.
* Announcing the new machine learning extension. This extension enables you to:
    * Manage Python and R packages with SQL Server machine learning services with Azure Data Studio.
    * Use ONNX model to make predictions in Azure SQL Edge.
    * View ONNX models in an Azure SQL Edge database.
    * Import ONNX models from a file or Azure Machine Learning into Azure SQL Edge database.
    * Create a notebook to run experiments.
* New notebook features:
    * Added new Python dependencies wizard
    * Improvements to the notebook markdown toolbar
* Added support for parameterization for Always Encrypted - Allows you to run queries that insert, update or filter by encrypted database columns.
* Bug fixes

## Version 1.17.1
* Release date: April 29, 2020
* Release status: General Availability
* Hotfix for https://github.com/microsoft/azuredatastudio/milestone/54?closed=1

## Version 1.17.0
* Release date: April 27, 2020
* Release status: General Availability
* New Welcome Page
* New Notebook features
    * New Markdown editor toolbar
    * Books viewlet now works with notebooks
* Improved dashboard
* Always encrypted support
* Accessibility bugs
* VS Code merge

## Version 1.16.0
* Release date: March 18, 2020
* Release status: General Availability
* Notebooks:
	* Charting
	* Creating Jupyter books
* Postgres extension update - Users can now authenticate to Azure Postgres servers with their linked Azure account
* Accessibility bugs
* VS Code merge
* In the next release, GitHub releases will no longer contain the binary files to the latest version. Rather, they will contain links to the latest release. This will have no impact on users using the in-app update functionality.

## Version 1.15.1
* Release date: February 19, 2020
* Release status: General Availability
* Resolved [#9145 Edit Data render the result grid incorrectly when using custom query](https://github.com/microsoft/azuredatastudio/issues/9145).
* Resolved [#9149 Show Active Connections](https://github.com/microsoft/azuredatastudio/issues/9149).

## Version 1.15.0
* Release date: February 13, 2020
* Release status: General Availability
* New Azure Sign-in improvement - Added improved Azure Sign-in experience, including removal of copy/paste of device code to make a more seamless connected experience.
* Find in Notebook support - Users can now use Ctrl+F inside of a notebook. Find in Notebook support searches line by line through both code and text cells.
* VS Code merge from 1.38 to 1.42 - This release includes updates to VS Code from the 3 previous VS Code releases. Read their [release notes](https://code.visualstudio.com/updates/v1_42) to learn more.
* Fix for the ["white/blank screen"](https://github.com/microsoft/azuredatastudio/issues/8775) issue reported by many users.
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue+label%3ABug+milestone%3A%22February+2020%22+is%3Aclosed).

## Version 1.14.1
* Release date: December 26, 2019
* Release status: General Availability
* Hotfix for bug https://github.com/microsoft/azuredatastudio/issues/8768

## Version 1.14.0
* Release date: December 19, 2019
* Release status: General Availability
* Added bigdatacluster.ignoreSslVerification setting to allow ignoring SSL verification errors when connecting to a BDC [#8129](https://github.com/microsoft/azuredatastudio/issues/8129)
* Changed attach to connection dropdown in Notebooks to only list the currently active connection [#8582](https://github.com/microsoft/azuredatastudio/pull/8582)
* Allow changing default language flavor for offline query editors [#8419](https://github.com/microsoft/azuredatastudio/pull/8419)
* GA status for Big Data Cluster/SQL 2019 features [#8269](https://github.com/microsoft/azuredatastudio/issues/8269)
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/44?closed=1).

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

## Version 1.13.1
* Release date: November 15, 2019
* Release status: General Availability
* Resolved [#8210 Copy/Paste results are out of order](https://github.com/microsoft/azuredatastudio/issues/8210).

## Version 1.13.0
* Release date: November 4, 2019
* Release status: General Availability
* General Availability release for Schema Compare and DACPAC extensions
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/43?closed=1).

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:
* aspnerd for `Use selected DB for import wizard schema list` [#7878](https://github.com/microsoft/azuredatastudio/pull/7878)

## Version 1.12.2
* Release date: October 11, 2019
* Release status: General Availability
* Hotfix release (1.12.2): `Disable automatically starting the EH in inspect mode` https://github.com/microsoft/azuredatastudio/commit/c9bef82ace6c67190d0e83820011a2bbd1f793c1

## Version 1.12.1
* Release date: October 7, 2019
* Release status: General Availability
* Hotfix release: `Notebooks: Ensure quotes and backslashes are escaped properly in text editor model` https://github.com/microsoft/azuredatastudio/pull/7540

## Version 1.12.0
* Release date: October 2, 2019
* Release status: General Availability

### What's new in this version
* Announcing the Query History panel
* Improved Query Results Grid copy selection support
* TempDB page added to Server Reports extension
* PowerShell extension update
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/42?closed=1).

## Version 1.11.0
* Release date: September 10, 2019
* Release status: General Availability

### What's new in this version
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/41?closed=1).

## Version 1.10.0
* Release date: August 14, 2019
* Release status: General Availability

### What's new in this version
* [SandDance](https://github.com/microsoft/SandDance) integration — A new way to interact with data. Download the extension [here](https://docs.microsoft.com/sql/azure-data-studio/sanddance-extension)
* Notebook improvements
   * Better loading performance
   * Ability to right click SQL results grid to save your results as CSV, JSON, etc.
   * Buttons to add code or text cells in-line
   * [Other fixes and improvements](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue+label%3A%22Area%3A+Notebooks%22+milestone%3A%22August+2019+Release%22+is%3Aclosed)
* SQL Server Dacpac extension can support Azure Active Directory authentication
* Updated SQL Server 2019 extension
* Visual Studio Code May Release Merge 1.37 - this includes changes from [1.36](https://code.visualstudio.com/updates/v1_37) and [1.37](https://code.visualstudio.com/updates/v1_37)
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/39?closed=1).

## Version 1.9.0
* Release date: July 11, 2019
* Release status: General Availability

### What's new in this version
* Release of [SentryOne Plan Explorer Extension](https://www.sentryone.com/products/sentryone-plan-explorer-extension-azure-data-studio)
* **Schema Compare**
    * Schema Compare File Support (.SCMP)
    * Cancel support
    * [Other fixes and improvements](https://github.com/Microsoft/azuredatastudio/issues?q=is%3Aissue+milestone%3A%22July+2019+Release%22+is%3Aclosed+label%3A%22Area%3A+Schema+Compare%22)
* **Notebooks**
    * Plotly Support
    * Open Notebook from Browser
    * Python Package Management
    * Performance & Markdown Enhancements
    * Improved Keyboard Shortcuts
    * [Other fixes and improvements](https://github.com/Microsoft/azuredatastudio/issues?q=is%3Aissue+milestone%3A%22July+2019+Release%22+is%3Aclosed+label%3A%22Area%3A+Notebooks%22)
* **SQL Server Profiler**
    * Filtering by Database Name
    * Copy & Paste Support
    * Save/Load Filter
* SQL Server 2019 Support
* New Language Packs Available
* Visual Studio Code May Release Merge 1.35 - the latest improvements can be found [here](https://code.visualstudio.com/updates/v1_35)
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/35?closed=1).

## Version 1.8.0
* Release date: June 6, 2019
* Release status: General Availability

### What's new in this version
* Initial release of the Database Admin Tool Extensions for Windows *Preview* extension
* Initial release of the Central Management Servers extension
* **Schema Compare**
   * Added Exclude/Include Options
   * Generate Script opens script after being generated
   * Removed double scroll bars
   * Formatting and layout improvements
   * Complete changes can be found [here](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue+milestone%3A%22June+2019+Release%22+label%3A%22Area%3A+Schema+Compare%22+is%3Aclosed)
* Messages panel moved into results panel - when users ran SQL queries, results and messages were in stacked panels. Now they are in separate tabs in a single panel similar to SSMS.
* **Notebook**
   * Users can now choose to use their own Python 3 or Anaconda installs in notebooks
   * Multiple Stability + fit/finish fixes
   * View the full list of improvements and fixes [here](https://github.com/microsoft/azuredatastudio/issues?q=is%3Aissue+milestone%3A%22June+2019+Release%22+is%3Aclosed+label%3A%22Area%3A+Notebooks%22)
* Visual Studio Code May Release Merge 1.34 - the latest improvements can be found [here](https://code.visualstudio.com/updates/v1_34)
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/32?closed=1).

## Version 1.7.0
* Release date: May 8, 2019
* Release status: General Availability

### What's new in this version
* Announcing Schema Compare *Preview* extension
* Tasks Panel UX improvement
* Announcing new Welcome page
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/31?closed=1).

### Contributions and "thank you"
We would like to thank all our users who raised issues.

## Version 1.6.0
* Release date: April 18, 2019
* Release status: General Availability

### What's new in this version
* Align with latest VS Code editor platform (currently 1.33.1)
* Resolved [bugs and issues](https://github.com/Microsoft/azuredatastudio/milestone/26?closed=1).

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* yamatoya for `fix the format (#4899)`

## Version 1.5.1
* Release date: March 18, 2019
* Release status: General Availability

### What's new in this version
* Announcing T-SQL Notebooks
* Announcing PostgreSQL extension
* Announcing SQL Server Dacpac extension
* Resolved [bugs and issues](https://github.com/Microsoft/azuredatastudio/milestone/25?closed=1).

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* GeoffYoung for `Fix sqlDropColumn description #4422`

## Version 1.4.5
* Release date: February 13, 2019
* Release status: General Availability

### What's new in this version
* Added **Admin pack for SQL Server** extension pack to make it easier to install SQL Server admin-related extensions. This includes:
    * [SQL Server Agent](https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-server-agent-extension?view=sql-server-2017)
    * [SQL Server Profiler](https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-server-profiler-extension?view=sql-server-2017)
    * [SQL Server Import](https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-server-import-extension?view=sql-server-2017)
* Added filtering extended event support in Profiler extension
* Added Save as XML feature that can save T-SQL results as XML
* Added Data-Tier Application Wizard improvements
    * Added Generate script button
    * Added view to give warnings of possible data loss during deployment
* Updates to the [SQL Server 2019 Preview extension](https://docs.microsoft.com/sql/azure-data-studio/sql-server-2019-extension?view=sql-server-ver15)
* Results streaming enabled by default for long running queries
* Resolved [bugs and issues](https://github.com/Microsoft/azuredatastudio/milestone/23?closed=1).

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* AlexFsmn for `Added context menu for DBs in explorer view to backup & restore db. #2277`
* sadedil for `Missing feature request: Save as XML #3729`
* gbritton1 for `Removed reference to object explorer #3463`

## Version 1.3.8
* Release date: January 9, 2019
* Release status: General Availability

### What's new in this version
* #13 Feature Request: Azure Active Directory Authentication
* #1040 Stream initial query results as they become available
* #3298 Сan't add an azure account.
* #2387 Support Per-User Installer
* SQL Server Import updates for DACPAC\BACPAC
* SQL Server Profiler UI and UX improvements
* Updates to [SQL Server 2019 extension](https://docs.microsoft.com/sql/azure-data-studio/sql-server-2019-extension?view=sql-server-ver15)
* **sp_executesql to SQL** and **New Database** extensions

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* Tarig0  for `Add Routine_Type to CreateStoredProc fixes #3257 (#3286)`
* oltruong  for `typo fix #3025'`
* Thomas-S-B for `Removed unnecessary IErrorDetectionStrategy #749`
* Thomas-S-B for `Simplified code #750`

## Version 1.2.4
* Release date: November 6, 2018
* Release status: General Availability

### What's new in this version
* Update to the SQL Server 2019 Preview extension
* Introducing Paste the Plan extension
* Introducing High Color queries extension, including SSMS editor theme
* Fixes in SQL Server Agent, Profiler, and Import extensions
* Fix .Net Core Socket KeepAlive issue causing dropped inactive connections on macOS
* Upgrade SQL Tools Service to .Net Core 2.2 Preview 3 (for eventual AAD support)
* Fix customer reported GitHub issues

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* rdaniels6813  for `Add query plan theme support #3031`
* Ruturaj123 for `Fixed some typos and grammatical errors #3027`
* PromoFaux for `Use emoji shortcodes in CONTRIBUTING.md instead of � #3009`
* ckaczor for `Fix: DATETIMEOFFSET data types should be ISO formatted #714`
* hi-im-T0dd for `Fixed sync issue with my forked master so this commit is correct #2948`
* hi-im-T0dd for `Fixed when right clicking and selecting Manage-correct name displays #2794`

## Version 1.1.3
* Release date: October 18, 2018
* Release status: General Availability

### What's new in this version
* Introducing the Azure Resource Explorer to browse Azure SQL Databases
* Improve Object Explorer and Query Editor connectivity robustness
* SQL Server 2019 and SQL Agent extension improvements

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* philoushka  for `center the icon #2760`
* anthonypants for `Typo #2775`
* kstolte for `Fix Invalid Configuration in Launch.json #2789`
* kstolte for `Fixing a reference to SQL Ops Studio #2788`

## Version 1.0.0
* Release date: September 24, 2018
* Release status: General Availability

### What's new in this version
* Announcing the SQL Server 2019 Preview extension.
  * Support for SQL Server 2019 preview features including Big Data Cluster support.
  * Azure Data Studio Notebooks
  * The Azure Resource Explorer viewlets you browse data-related endpoints for your Azure accounts and create connections to them in Object Explorer. In this release Azure SQL Databases and servers are supported.
  * SQL Server Polybase Create External Table Wizard
* Query Results Grid performance and UX improvements for large number of result sets.
* Visual Studio Code source code refresh from 1.23 to 1.26.1 with Grid Layout and Improved Settings Editor (preview).
* Accessibility improvements for screen reader, keyboard navigation and high-contrast.
* Added Connection name option to provide an alternative display name in the Servers viewlet.

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* AlexFsmn `Feature: Ability to add connection name #2332`
* AlexFsmn `Disabled connection name input when connecting to a server. #2566`

## Version 0.33.7
* Release date: August 30, 2018
* Release status: Public Preview

### What's new in this version
* Announcing the SQL Server Import Extension
* SQL Server Profiler Session management
* SQL Server Agent improvements
* New community extension: First Responder Kit
* Quality of Life improvements: Connection strings
* Fix many customer reported GitHub issues

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* SebastianPfliegel `Added more saveAsCsv options #2099`
* ianychoi `Fixes a typo: Mimunum -> Minimum #1994`
* AlexFsmn `Fixed bug where proper file extension wasn't appended to filename. #2151`
* AlexFsmn `Added functionality for adding any file to import wizard #2329`
* AlexFsmn `Fixed background issue when copying a chart to clipboard #2215`
* AlexFsmn `Fixed problem where vertical charts didn't display labels correctly. #2263`
* AlexFsmn `Fixed Initial values for charts to match visuals #2266`
* AlexFsmn `Renamed chart option labels #2264`
* AlexFsmn `Added feature for opening file after exporting to CSV/XLS/JSON & query files #2216`
* AlexFsmm `Get Connection String should copy to clipboard #2175`

## Version 0.31.4
* Release date: July 19, 2018
* Release status: Public Preview

### What's new in this version
* SQL Server Agent for Azure Data Studio extension improvements
  * Added view of Alerts, Operators, and Proxies and icons on left pane
  * Added dialogs for New Job, New Job Step, New Alert, and New Operator
  * Added Delete Job, Delete Alert, and Delete Operator (right-click)
  * Added Previous Runs visualization
  * Added Filters for each column name
* SQL Server Profiler for Azure Data Studio extension improvements
  * Added Hotkeys to quickly launch and start/stop Profiler
  * Added 5 Default Templates to view Extended Events
  * Added Server/Database connection name
  * Added support for Azure SQL Database instances
  * Added suggestion to exit Profiler when tab is closed when Profiler is still running
* Release of Combine Scripts Extension
* Wizard and Dialog Extensibility
* Fix GitHub Issues

## Version 0.30.6
* Release date: June 20, 2018
* Release status: Public Preview

### What's new in this version
* **SQL Server Profiler for Azure Data Studio  *Preview*** extension initial release
* The new **SQL Data Warehouse** extension includes rich customizable dashboard widgets surfacing insights to your data warehouse. This unlocks key scenarios around managing and tuning your data warehouse to ensure it is optimized for consistent performance.
* **Edit Data "Filtering and Sorting"** support
* **SQL Server Agent for Azure Data Studio *Preview*** extension enhancements for Jobs and Job History views
* Improved **Wizard & Dialog UI Builder Framework** extensibility APIs
* Update VS Code Platform source code integrating [March 2018 (1.22)](https://code.visualstudio.com/updates/v1_22) and [April 2018 (1.23)](https://code.visualstudio.com/updates/v1_23)  releases
* Fix GitHub Issues

## Version 0.29.3
* Release date: May 7, 2018
* Release status: Public Preview

### What's new in this version
The May release is focused on stabilization and bug fixes leading up to the Build conference.  This build contains the following highlights.

* Announcing **Redgate SQL Search** extension available in Extension Manager
* Community Localization available for 10 languages: **German, Spanish, French, Italian, Japanese, Korean, Portuguese, Russian, Simplified Chinese and Traditional Chinese!**
* Reduced telemetry collection, improved [opt-out](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Disable-Telemetry-Reporting) experience and in-product links to [Privacy Statement](https://privacy.microsoft.com/privacystatement)
* Extension Manager has improved Marketplace experience to easily discover community extensions
* SQL Agent extension Jobs and Job History view improvement
* Updates for **whoisactive** and **Server Reports** extensions
* Continue to fix GitHub issues

## Version 0.28.6
* Release date: April 25, 2018
* Release status: Public Preview

### What's new in this version
The April Public Preview release contains some of the following highlights.

* Improvements to SQL Agent *Preview* extension
* Accessibility improvements for keyboard navigation, screen reader support and high-contrast mode.
* Improved large and protected file support for saving Admin protected and >256M files within SQL Ops Studio
* Integrated Terminal splitting to work with multiple open terminals at once
* Reduced installation on-disk file count foot print for faster installs and startup times
* Improvements to Server Reports extension
* Continue to fix GitHub issues

## Version 0.27.3
* Release date: March 28, 2017
* Release status: Public Preview

### What's new in this version
The March Public Preview release enables some key aspects of the Azure Data Studio
extensibility story.  Here are some highlights in this release.

* Enhance the Manage Dashboard extensibility model to support tabbed Insights and Configuration panes
* Dashboard Insights extensions for `sp_whoisactive` from [whoisactive.com](http://whoisactive.com)
* Extension Manager enables simple acquisition of 1st-party and 3rd-party extensions
* Add additional Extensibility APIs for `connection` and `objectexplorer` management
* Community Localization open for 10 languages
* Continue to fix important customer impacting GitHub issues

## Version 0.26.7
* Release date: February 16, 2017
* Release status: Public Preview Hotfix 1

### What's new in this version
* Bug fix for `#717 Selecting partial query and hitting Cmd or Ctrl+C opens terminal with Error message`

## Version 0.26.6
* Release date: February 15, 2017
* Release status: Public Preview

### What's new in this version
The February release fixes several important customer reported issues, as well as various feature improvements.  We've also introduced auto-update support in February which will simplify keeping updated with the lastest changes.

Here's some of the highlights in the February release.

* Support Auto-Update installation on Windows and macOS
* Publish RPM and DEB packages to offical Microsoft repos
* Fix `#6 Keep connection and selected database when opening new query tabs`
* Fix `#22 'Server Name' and 'Database Name' - Can these be drop downs instead of text` boxes?
* Fix #481 Add "Check for updates" option.
* SQL Editor colorization and auto-completion fixes
  * `#584 Keyword "FULL" not highlighted by IntelliSense`
  * `#345 Colorize SQL functions within the editor`
  * `#300 [#tempData] latest "]" will display green color`
  * `#225 Keyword color mismatch`
  * `#60 invalid sql syntax color highlighting when using temporary table in from clause`
* Introduce Connection extensibility API
* VS Code Editor 1.19 integration
* Update JustinPealing/html-query-plan component to pick-up several Query Plan viewer improvements

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`

## Version 0.25.4
* Release date: January 17, 2017
* Release status: Public Preview

### What's new in this version
The January release focuses on addressing a few of the top upvoted feature suggestions, as well as fixing high-priority bugs.  This release period coincides with holiday vacations, so the churn in this release is
relatively scoped.

Here's some of the highlights in the January release.

* Tab-coloring based on Server Group
* Saved Server connections are available in Connection Dialog
* Enable HotExit feature
* Fix broken Run Current Query command
* Fix drag-and-drop breaking scripting bug
* Fix incorrect pinned Start Menu icon
* Fix missing Azure Account branding icon
* Change "Server name" to "Server" in Connection Dialog

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* alextercete for `Fix "No extension gallery service configured" error (#427)`
* SebastianPfliegel for `Add cursor snippet (#475)`

## Version 0.24.1
* Release date: December 19, 2017
* Release status: Public Preview

### What's new in this version
* Azure Integration with Create Firewall Rule
* Windows Setup, Linux DEB and Linux RPM installation packages
* Manage Dashboard visual layout editor
* Script As Alter and Script As Execute commands
* Integrate VS Code 1.18.1 editor platform
* Enable Sideloading of VSIX Extension files
* Support "GO N" batch iteration syntax
* "Run Current Query with Actual Plan" command
* Delete Recent Connection command in Connection Dialog
* Performance fixes for Object Explorer expansion and Scripting sprocs
* Fix IntelliSense settings namespace to be `mssql.*`
* Only show `Disconnect` menu item if server is connected
* Several snippet and default widget improvements
* Improve Kerberos connection failure error message
* Add command to hide query results window after running query
* Retain cursor line positon when switching document tabs
* Keep cursor focus in editor window after executing query
* Support shortcuts to execute common queries like sp_who or sp_help
* Fix tab order behavior when using keyboard to navigate dialog controls
* Improved chart axis and label behavior
* Allow expanding databases not in certain non-Online states
* Connection Dialog selects most common default authentication method based on platform

### Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`
