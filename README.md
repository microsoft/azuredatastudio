# SQL Operations Studio

SQL Operations Studio is a data management tool that enables you to work with SQL Server, Azure SQL DB and SQL DW from Windows, macOS and Linux.

**Download SQL Operations Studio February Public Preview**

Platform | Link
-- | --
Windows Setup Installer | https://go.microsoft.com/fwlink/?linkid=867998
Windows ZIP | https://go.microsoft.com/fwlink/?linkid=867997
macOS ZIP | https://go.microsoft.com/fwlink/?linkid=867999
Linux TAR.GZ | https://go.microsoft.com/fwlink/?linkid=868000
Linux DEB | https://go.microsoft.com/fwlink/?linkid=868002
Linux RPM | https://go.microsoft.com/fwlink/?linkid=868001

Go to our [download page](https://aka.ms/sqlopsstudio) for more specific instructions.

Try out the latest insiders build from `master` at https://github.com/Microsoft/sqlopsstudio/releases.

See the [change log](https://github.com/Microsoft/sqlopsstudio/blob/master/CHANGELOG.md) for additional details of what's in this release.

**Feature Highlights**

- Cross-Platform DB management for Windows, macOS and Linux with simple XCopy deployment
- SQL Server Connection Management with Connection Dialog, Server Groups, Azure Integration and Registered Servers
- Object Explorer supporting schema browsing and contextual command execution
- T-SQL Query Editor with advanced coding features such as autosuggestions, error diagnostics, tooltips, formatting and peek definition
- Query Results Viewer with advanced data grid supporting large result sets, export to JSON\CSV\Excel, query plan and charting
- Management Dashboard supporting customizable widgets with drill-through actionable insights
- Visual Data Editor that enables direct row insertion, update and deletion into tables
- Backup and Restore dialogs that enables advanced customization and remote filesystem browsing, configured tasks can be executed or scripted
- Task History window to view current task execution status, completion results with error messages and task T-SQL scripting
- Scripting support to generate CREATE, SELECT, ALTER and DROP statements for database objects
- Workspaces with full Git integration and Find In Files support to managing T-SQL script libraries
- Modern light-weight shell with theming, user settings, full screen support, integrated terminal and numerous other features

Here's some of these features in action.

<img src='https://github.com/Microsoft/sqlopsstudio/blob/master/docs/overview_screen.jpg' width='800px'>

## Contributing
If you are interested in fixing issues and contributing directly to the code base,
please see the document [How to Contribute](https://github.com/Microsoft/sqlopsstudio/wiki/How-to-Contribute), which covers the following:

* [How to build and run from source](https://github.com/Microsoft/sqlopsstudio/wiki/How-to-Contribute#Build-and-Run-From-Source)
* [The development workflow, including debugging and running tests](https://github.com/Microsoft/sqlopsstudio/wiki/How-to-Contribute#development-workflow)
* [Submitting pull requests](https://github.com/Microsoft/sqlopsstudio/wiki/How-to-Contribute#pull-requests)

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement
The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`
* alextercete for `Fix "No extension gallery service configured" error (#427)`
* SebastianPfliegel for `Add cursor snippet (#475)`
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](LICENSE.txt).
