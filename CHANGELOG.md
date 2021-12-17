# Change Log

 ## Version 1.34.0
* Release date: December 15, 2021
* Release status: General Availability
## What's new in this version
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

## Hotfix release
- Fix for [#16535 Unable to See Saved Connections in Restricted Mode](https://github.com/microsoft/azuredatastudio/issues/17535)
- Fix for [#17579 Can't type in Notebook code cell after editing text cell](https://github.com/microsoft/azuredatastudio/issues/17579)

    

| Platform																|
| ---------------------------------------	|
| [Windows User Installer][win-user]			|
| [Windows System Installer][win-system]	|
| [Windows ZIP][win-zip]									|
| [macOS ZIP][osx-zip]										|
| [Linux TAR.GZ][linux-zip]								|
| [Linux RPM][linux-rpm]									|
| [Linux DEB][linux-deb]									|

[win-user]: https://go.microsoft.com/fwlink/?linkid=2176805
[win-system]: https://go.microsoft.com/fwlink/?linkid=2175910
[win-zip]: https://go.microsoft.com/fwlink/?linkid=2176806
[osx-zip]: https://go.microsoft.com/fwlink/?linkid=2176807
[linux-zip]: https://go.microsoft.com/fwlink/?linkid=2176505
[linux-rpm]: https://go.microsoft.com/fwlink/?linkid=2176005
[linux-deb]: https://go.microsoft.com/fwlink/?linkid=2176006

## Version 1.33.0
* Release date: October 27, 2021
* Release status: General Availability
## What's new in this version
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
## Hotfix Release
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

## Contributions and "thank you"
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

## Contributions and "thank you"
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

## What's new in this version
* Announcing the Query History panel
* Improved Query Results Grid copy selection support
* TempDB page added to Server Reports extension
* PowerShell extension update
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/42?closed=1).

## Version 1.11.0
* Release date: September 10, 2019
* Release status: General Availability

## What's new in this version
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/41?closed=1).

## Version 1.10.0
* Release date: August 14, 2019
* Release status: General Availability

## What's new in this version
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

## What's new in this version
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

## What's new in this version
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

## What's new in this version
* Announcing Schema Compare *Preview* extension
* Tasks Panel UX improvement
* Announcing new Welcome page
* Resolved [bugs and issues](https://github.com/microsoft/azuredatastudio/milestone/31?closed=1).

## Contributions and "thank you"
We would like to thank all our users who raised issues.

## Version 1.6.0
* Release date: April 18, 2019
* Release status: General Availability

## What's new in this version
* Align with latest VS Code editor platform (currently 1.33.1)
* Resolved [bugs and issues](https://github.com/Microsoft/azuredatastudio/milestone/26?closed=1).

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* yamatoya for `fix the format (#4899)`

## Version 1.5.1
* Release date: March 18, 2019
* Release status: General Availability

## What's new in this version
* Announcing T-SQL Notebooks
* Announcing PostgreSQL extension
* Announcing SQL Server Dacpac extension
* Resolved [bugs and issues](https://github.com/Microsoft/azuredatastudio/milestone/25?closed=1).

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* GeoffYoung for `Fix sqlDropColumn description #4422`

## Version 1.4.5
* Release date: February 13, 2019
* Release status: General Availability

## What's new in this version
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

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* AlexFsmn for `Added context menu for DBs in explorer view to backup & restore db. #2277`
* sadedil for `Missing feature request: Save as XML #3729`
* gbritton1 for `Removed reference to object explorer #3463`

## Version 1.3.8
* Release date: January 9, 2019
* Release status: General Availability

## What's new in this version
* #13 Feature Request: Azure Active Directory Authentication
* #1040 Stream initial query results as they become available
* #3298 Сan't add an azure account.
* #2387 Support Per-User Installer
* SQL Server Import updates for DACPAC\BACPAC
* SQL Server Profiler UI and UX improvements
* Updates to [SQL Server 2019 extension](https://docs.microsoft.com/sql/azure-data-studio/sql-server-2019-extension?view=sql-server-ver15)
* **sp_executesql to SQL** and **New Database** extensions

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* Tarig0  for `Add Routine_Type to CreateStoredProc fixes #3257 (#3286)`
* oltruong  for `typo fix #3025'`
* Thomas-S-B for `Removed unnecessary IErrorDetectionStrategy #749`
* Thomas-S-B for `Simplified code #750`

## Version 1.2.4
* Release date: November 6, 2018
* Release status: General Availability

## What's new in this version
* Update to the SQL Server 2019 Preview extension
* Introducing Paste the Plan extension
* Introducing High Color queries extension, including SSMS editor theme
* Fixes in SQL Server Agent, Profiler, and Import extensions
* Fix .Net Core Socket KeepAlive issue causing dropped inactive connections on macOS
* Upgrade SQL Tools Service to .Net Core 2.2 Preview 3 (for eventual AAD support)
* Fix customer reported GitHub issues

## Contributions and "thank you"
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

## What's new in this version
* Introducing the Azure Resource Explorer to browse Azure SQL Databases
* Improve Object Explorer and Query Editor connectivity robustness
* SQL Server 2019 and SQL Agent extension improvements

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* philoushka  for `center the icon #2760`
* anthonypants for `Typo #2775`
* kstolte for `Fix Invalid Configuration in Launch.json #2789`
* kstolte for `Fixing a reference to SQL Ops Studio #2788`

## Version 1.0.0
* Release date: September 24, 2018
* Release status: General Availability

## What's new in this version
* Announcing the SQL Server 2019 Preview extension.
  * Support for SQL Server 2019 preview features including Big Data Cluster support.
  * Azure Data Studio Notebooks
  * The Azure Resource Explorer viewlets you browse data-related endpoints for your Azure accounts and create connections to them in Object Explorer. In this release Azure SQL Databases and servers are supported.
  * SQL Server Polybase Create External Table Wizard
* Query Results Grid performance and UX improvements for large number of result sets.
* Visual Studio Code source code refresh from 1.23 to 1.26.1 with Grid Layout and Improved Settings Editor (preview).
* Accessibility improvements for screen reader, keyboard navigation and high-contrast.
* Added Connection name option to provide an alternative display name in the Servers viewlet.

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* AlexFsmn `Feature: Ability to add connection name #2332`
* AlexFsmn `Disabled connection name input when connecting to a server. #2566`

## Version 0.33.7
* Release date: August 30, 2018
* Release status: Public Preview

## What's new in this version
* Announcing the SQL Server Import Extension
* SQL Server Profiler Session management
* SQL Server Agent improvements
* New community extension: First Responder Kit
* Quality of Life improvements: Connection strings
* Fix many customer reported GitHub issues

## Contributions and "thank you"
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

## What's new in this version
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

## What's new in this version
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

## What's new in this version
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

## What's new in this version
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

## What's new in this version
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

## What's new in this version
* Bug fix for `#717 Selecting partial query and hitting Cmd or Ctrl+C opens terminal with Error message`

## Version 0.26.6
* Release date: February 15, 2017
* Release status: Public Preview

## What's new in this version
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

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`

## Version 0.25.4
* Release date: January 17, 2017
* Release status: Public Preview

## What's new in this version
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

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* alextercete for `Fix "No extension gallery service configured" error (#427)`
* SebastianPfliegel for `Add cursor snippet (#475)`

## Version 0.24.1
* Release date: December 19, 2017
* Release status: Public Preview

## What's new in this version
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

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`
