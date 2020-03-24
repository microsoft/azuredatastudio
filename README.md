# Azure Data Studio

[![Join the chat at https://gitter.im/Microsoft/sqlopsstudio](https://badges.gitter.im/Microsoft/sqlopsstudio.svg)](https://gitter.im/Microsoft/sqlopsstudio?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://dev.azure.com/azuredatastudio/azuredatastudio/_apis/build/status/Azure%20Data%20Studio%20CI?branchName=master)](https://dev.azure.com/azuredatastudio/azuredatastudio/_build/latest?definitionId=4&branchName=master)
[![Twitter Follow](https://img.shields.io/twitter/follow/azuredatastudio?style=social)](https://twitter.com/azuredatastudio)

Azure Data Studio is a data management tool that enables you to work with SQL Server, Azure SQL DB and SQL DW from Windows, macOS and Linux.

## **Download the latest Azure Data Studio release**

| Platform																|
| ---------------------------------------	|
| [Windows User Installer][win-user]			|
| [Windows System Installer][win-system]	|
| [Windows ZIP][win-zip]									|
| [macOS ZIP][osx-zip]										|
| [Linux TAR.GZ][linux-zip]								|
| [Linux RPM][linux-rpm]									|
| [Linux DEB][linux-deb]									|


Go to our [download page](https://aka.ms/azuredatastudio) for more specific instructions.

## Try out the latest insiders build from `master`:
- [Windows User Installer - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/win32-x64-user/insider)
- [Windows System Installer - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/win32-x64/insider)
- [Windows ZIP - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/win32-x64-archive/insider)
- [macOS ZIP - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/darwin/insider)
- [Linux TAR.GZ - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/linux-x64/insider)

See the [change log](https://github.com/Microsoft/azuredatastudio/blob/master/CHANGELOG.md) for additional details of what's in this release.

## **Feature Highlights**

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
- Modern light-weight shell with theming, user settings, full-screen support, integrated terminal and numerous other features

Here are some of these features in action.

<img src='https://github.com/Microsoft/azuredatastudio/blob/master/docs/overview_screen.jpg' width='800px'>

## Contributing
If you are interested in fixing issues and contributing directly to the code base,
please see the document [How to Contribute](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute), which covers the following:

* [How to build and run from source](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#Build-and-Run-From-Source)
* [The development workflow, including debugging and running tests](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#development-workflow)
* [Submitting pull requests](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#pull-requests)

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Localization
Azure Data Studio localization is now open for community contributions. You can contribute to localization for both software and docs. https://aka.ms/SQLOpsStudioLoc

Localization is now opened for 10 languages: French, Italian, German, Spanish, Simplified Chinese, Traditional Chinese, Japanese, Korean, Russian, and Portuguese (Brazil). Help us make Azure Data Studio available in your language!

## Privacy Statement
The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## Contributions and "Thank You"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* eulercamposbarros for `Prevent connections from moving on click (#7528)`
* AlexFsmn for `Fixed issue where task icons got hidden if text was too long`
* jamesrod817 for `Tempdb (#7022)`
* dzsquared for `fix(snippets): ads parenthesis to sqlcreateindex snippet #7020`
* devmattrick for `Update row count as updates are received #6642`
* mottykohn for `In Message panel onclick scroll to line #6417`
* Stevoni for `Corrected Keyboard Shortcut Execution Issue #5480`
* yamatoya for `fix the format #4899`
* GeoffYoung for `Fix sqlDropColumn description #4422`
* AlexFsmn for `Added context menu for DBs in explorer view to backup & restore db. #2277`
* sadedil for `Missing feature request: Save as XML #3729`
* gbritton1 for `Removed reference to object explorer #3463`
* Tarig0  for `Add Routine_Type to CreateStoredProc fixes #3257 (#3286)`
* oltruong  for `typo fix #3025'`
* Thomas-S-B for `Removed unnecessary IErrorDetectionStrategy #749`
* Thomas-S-B for `Simplified code #750`
* rdaniels6813  for `Add query plan theme support #3031`
* Ruturaj123 for `Fixed some typos and grammatical errors #3027`
* PromoFaux for `Use emoji shortcodes in CONTRIBUTING.md instead of � #3009`
* ckaczor for `Fix: DATETIMEOFFSET data types should be ISO formatted #714`
* hi-im-T0dd for `Fixed sync issue with my forked master so this commit is correct #2948`
* hi-im-T0dd for `Fixed when right clicking and selecting Manage-correct name displays #2794`
* philoushka  for `center the icon #2760`
* anthonypants for `Typo #2775`
* kstolte for `Fix Invalid Configuration in Launch.json #2789`
* kstolte for `Fixing a reference to SQL Ops Studio #2788`
* AlexFsmn `Feature: Ability to add connection name #2332`
* AlexFsmn `Disabled connection name input when connecting to a server. #2566`
* SebastianPfliegel `Added more saveAsCsv options #2099`
* ianychoi `Fixes a typo: Mimunum -> Minimum #1994`
* AlexFsmn `Fixed bug where proper file extension wasn't appended to the filename. #2151`
* AlexFsmn `Added functionality for adding any file to import wizard #2329`
* AlexFsmn `Fixed background issue when copying a chart to clipboard #2215`
* AlexFsmn `Fixed problem where vertical charts didn't display labels correctly. #2263`
* AlexFsmn `Fixed Initial values for charts to match visuals #2266`
* AlexFsmn `Renamed chart option labels #2264`
* AlexFsmn `Added feature for the opening file after exporting to CSV/XLS/JSON & query files #2216`
* AlexFsmm `Get Connection String should copy to clipboard #2175`
* lanceklinger `Fix for double-clicking column handle in results table #1504`
* westerncj for `Removed duplicate contribution from README.md (#753)`
* ntovas for `Fix for duplicate extensions shown in "Save File" dialog. (#779)`
* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for the fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`
* alextercete for `Fix "No extension gallery service configured" error (#427)`
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with a case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`
* Adam Machanic for helping with the `whoisactive` extension
* All community localization contributors:
  * French: Adrien Clerbois, ANAS BELABBES, Antoine Griffard, Arian Papillon, Eric Macarez, Eric Van Thorre, Jérémy LANDON, Matthias GROSPERRIN, Maxime COQUEREL, Olivier Guinart, thierry DEMAN-BARCELÒ, Thomas Potier
  * Italian: Aldo Donetti, Alessandro Alpi, Andrea Dottor, Bruni Luca, Gianluca Hotz, Luca Nardi, Luigi Bruno, Marco Dal Pino, Mirco Vanini, Pasquale Ceglie, Riccardo Cappello, Sergio Govoni, Stefano Demiliani
  * German: Anna Henke-Gunvaldson, Ben Weissman, David Ullmer, J.M. ., Kai Modo, Konstantin Staschill, Kostja Klein, Lennart Trunk, Markus Ehrenmüller-Jensen, Mascha Kroenlein, Matthias Knoll, Mourad Louha, Thomas Hütter, Wolfgang Straßer
  * Spanish: Alberto Poblacion, Andy Gonzalez, Carlos Mendible, Christian Araujo, Daniel D, Eickhel Mendoza, Ernesto Cardenas, Ivan Toledo Ivanovic, Fran Diaz, JESUS GIL, Jorge Serrano Pérez, José Saturnino Pimentel Juárez, Mauricio Hidalgo, Pablo Iglesias, Rikhardo Estrada Rdez, Thierry DEMAN, YOLANDA CUESTA ALTIERI
  * Japanese: Fujio Kojima, Kazushi KAMEGAWA, Masayoshi Yamada, Masayuki Ozawa, Seiji Momoto, Takashi Kanai, Takayoshi Tanaka, Yoshihisa Ozaki, 庄垣内治
  * Chinese (simplified): DAN YE, Joel Yang, Lynne Dong, Ryan（Yu） Zhang, Sheng Jiang, Wei Zhang, Zhiliang Xu
  * Chinese  (Traditional): Bruce Chen, Chiayi Yen, Kevin Yang,  Winnie Lin, 保哥 Will,  謝政廷
  * Korean: Do-Kyun Kim, Evelyn Kim, Helen Jung, Hong Jmee, jeongwoo choi, Jun Hyoung Lee, Jungsun Kim정선, Justin Yoo, Kavrith mucha, Kiwoong Youm, MinGyu Ju,  MVP_JUNO BEA, Sejun Kim, SOONMAN KWON, sung man ko, Yeongrak Choi, younggun kim, Youngjae Kim, 소영 이
  * Russian: Andrey Veselov, Anton Fontanov, Anton Savin, Elena Ostrovskaia, Igor Babichev, Maxim Zelensky, Rodion Fedechkin, Tasha T, Vladimir Zyryanov
  * Portuguese Brazil: Daniel de Sousa, Diogo Duarte, Douglas Correa, Douglas Eccker, José Emanuel Mendes, Marcelo Fernandes, Marcondes Alexandre, Roberto Fonseca, Rodrigo Crespi

And of course, we'd like to thank the authors of all upstream dependencies.  Please see a full list in the [ThirdPartyNotices.txt](https://raw.githubusercontent.com/Microsoft/azuredatastudio/master/ThirdPartyNotices.txt)

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](LICENSE.txt).

[win-user]: https://go.microsoft.com/fwlink/?linkid=2121609
[win-system]: https://go.microsoft.com/fwlink/?linkid=2121612
[win-zip]: https://go.microsoft.com/fwlink/?linkid=2121511
[osx-zip]: https://go.microsoft.com/fwlink/?linkid=2121611
[linux-zip]: https://go.microsoft.com/fwlink/?linkid=2121510
[linux-rpm]: https://go.microsoft.com/fwlink/?linkid=2121613
[linux-deb]: https://go.microsoft.com/fwlink/?linkid=2121610



Apache License
                           Version 2.0, January 2004
                        https://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2020 Rolando Gopez Lacuata.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       https://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

