# SQL Operations Studio

[![Join the chat at https://gitter.im/Microsoft/sqlopsstudio](https://badges.gitter.im/Microsoft/sqlopsstudio.svg)](https://gitter.im/Microsoft/sqlopsstudio?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

SQL Operations Studio is a data management tool that enables you to work with SQL Server, Azure SQL DB and SQL DW from Windows, macOS and Linux.

**Download SQL Operations Studio May Public Preview**

Platform | Link
-- | --
Windows Setup Installer | https://go.microsoft.com/fwlink/?linkid=873386
Windows ZIP | https://go.microsoft.com/fwlink/?linkid=873387
macOS ZIP | https://go.microsoft.com/fwlink/?linkid=873388
Linux TAR.GZ | https://go.microsoft.com/fwlink/?linkid=873389
Linux RPM | https://go.microsoft.com/fwlink/?linkid=873390
Linux DEB | https://go.microsoft.com/fwlink/?linkid=873391

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

## Localization
SQL Operations Studio localization is now open for community contributions. You can contribute to localization for both software and docs. https://aka.ms/SQLOpsStudioLoc

Localization is now opened for 10 languages: French, Italian, German, Spanish, Simplified Chinese, Traditional Chinese, Japanese, Korean, Russian, and Portuguese (Brazil). Help us make SQL Operations Studio available in your language!

## Privacy Statement
The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* westerncj for `Removed duplicate contribution from README.md (#753)`
* ntovas for `Fix for duplicate extensions shown in "Save File" dialog. (#779)`
* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`
* alextercete for `Fix "No extension gallery service configured" error (#427)`
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`
* Adam Mechanic for helping with the `whoisactive` extension
* All community localization contributors
  * French: Adrien Clerbois, ANAS BELABBES, Antoine Griffard, Arian Papillon, Eric Macarez, Eric Van Thorre, Jérémy LANDON, Matthias GROSPERRIN, Maxime COQUEREL, Olivier Guinart, thierry DEMAN-BARCELÒ, Thomas Potier
  * Italian: Aldo Donetti, Alessandro Alpi, Andrea Dottor, Bruni Luca, Gianluca Hotz, Luca Nardi, Luigi Bruno, Marco Dal Pino, Mirco Vanini, Pasquale Ceglie, Riccardo Cappello, Sergio Govoni, Stefano Demiliani
  * German: Anna Henke-Gunvaldson, Ben Weissman, David Ullmer, J.M. ., Kai Modo, Konstantin Staschill, Kostja Klein, Lennart Trunk, Markus Ehrenmüller-Jensen, Mascha Kroenlein, Matthias Knoll, Mourad Louha, Thomas Hütter, Wolfgang Straßer
  * Spanish: Alberto Poblacion, Andy Gonzalez, Carlos Mendible, Christian Araujo, Daniel D, Eickhel Mendoza, Ernesto Cardenas, Ivan Toledo Ivanovic, Fran Diaz, JESUS GIL, Jorge Serrano Pérez, José Saturnino Pimentel Juárez, Mauricio Hidalgo, Pablo Iglesias, Rikhardo Estrada Rdez, Thierry DEMAN, YOLANDA CUESTA ALTIERI
  * Japanese: Fujio Kojima, Kazushi KAMEGAWA, Masayoshi Yamada, Masayuki Ozawa , Seiji Momoto, Takashi Kanai, Takayoshi Tanaka, Yoshihisa Ozaki, 庄垣内治
  * Chinese (simplified): DAN YE, Joel Yang, Lynne Dong, Ryan（Yu） Zhang, Sheng Jiang, Wei Zhang, Zhiliang Xu
  * Chinese  (Traditional): Bruce Chen, Chiayi Yen, Kevin Yang,  Winnie Lin, 保哥 Will,  謝政廷
  * Korean: Do-Kyun Kim, Evelyn Kim, Helen Jung, Hong Jmee, jeongwoo choi, Jun Hyoung Lee, Jungsun Kim정선, Justin Yoo, Kavrith mucha, Kiwoong Youm, MinGyu Ju,  MVP_JUNO BEA, Sejun Kim, SOONMAN KWON, sung man ko, Yeongrak Choi, younggun kim, Youngjae Kim, 소영 이
  * Russian: Andrey Veselov, Anton Fontanov, Anton Savin, Elena Ostrovskaia, Igor Babichev, Maxim Zelensky, Rodion Fedechkin, Tasha T, Vladimir Zyryanov
  * Portuguese Brazil: Daniel de Sousa, Diogo Duarte, Douglas Correa, Douglas Eccker, José Emanuel Mendes, Marcelo Fernandes, Marcondes Alexandre, Roberto Fonseca, Rodrigo Crespi   


And of course we'd like to thank the authors of all upstream dependencies.  Please see a full list in the [ThirdPartyNotices.txt](https://raw.githubusercontent.com/Microsoft/sqlopsstudio/master/ThirdPartyNotices.txt)

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](LICENSE.txt).
