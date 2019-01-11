# Microsoft SQL Server Import for Azure Data Studio

Microsoft SQL Server Import for Azure Data Studio includes two wizards: 
- [Import Flat File Wizard](#import-flat-file-wizard-preview)
- [Data-tier Application Wizard.](#data-tier-application-wizard-preview)

## Import Flat File Wizard *(preview)*
**The Import Flat File Wizard** is a simple way to copy data from a flat file (.csv, .txt, .json) to a SQL Server table. Checkout below the reasons for using the Import Flat File wizard, how to find this wizard, and a simple example.

This experience is currently in its initial preview. Please report issues and feature requests [here.](https://github.com/microsoft/azuredatastudio/issues)

<img src="https://user-images.githubusercontent.com/30873802/43433347-c958ed28-942b-11e8-8bbc-f4f2529c3978.png" width="800px" />

 ### Requirements
 * This wizard requires an active connection to a SQL Server instance to start.
 * This wizard only works on .txt and .csv files.

 ## How do I start the Flat File Import wizard?
 * In Azure Data Studio, press **Ctrl**+**I** to start the wizard.

 ### Why would I use the Import Flat File wizard?
This wizard was created to improve the current import experience leveraging an intelligent framework known as Program Synthesis using Examples ([PROSE](https://microsoft.github.io/prose/)). For a user without specialized domain knowledge, importing data can often be a complex, error prone, and tedious task. This wizard streamlines the import process as simple as selecting an input file and unique table name, and the PROSE framework handles the rest.

 PROSE analyzes data patterns in your input file to infer column names, types, delimiters, and more. This framework learns the structure of the file and does all of the hard work so users don't have to.

 Please note that the PROSE binary components used by this extension are licensed under the [MICROSOFT SQL TOOLS IMPORT FLAT FILE  EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/master/extensions/import/Microsoft_SQL_Server_Import_Extension_and_Tools_Import_Flat_File_Preview.docx).
 
## Data-tier Application Wizard *(preview)*
**The Data-tier Application Wizard** provides an easy to use experience to deploy and extract .dacpac files and import and export .bacpac files. 

This experience is currently in its initial preview. Please report issues and feature requests [here.](https://github.com/microsoft/azuredatastudio/issues)

<img src="https://user-images.githubusercontent.com/30873802/49676289-f2df6880-fa2d-11e8-8bfa-6213b7734075.png" width="800px" />

 ### Requirements
 * This wizard requires an active connection to a SQL Server instance to start.

 ### How do I start the Data-tier Application wizard?
 * The main entry point for the wizard is to right click a database in the Object Explorer, and click **Data-tier Application wizard**.
 * If a user is connected to a SQL Server instance, the user can also start the wizard from the command palette (Ctrl+Shift+P) by searching for **Data-tier Application wizard.**

 ### Why would I use the Data-tier Application wizard?
 This wizard was created to add the ability to extract and deploy .dacpac files and import and export .bacpac files in Azure Data Studio.
 
To learn more about Data-Tier Applications and working with dacpac and bacpac files, [you can read more here.](https://docs.microsoft.com/en-us/sql/relational-databases/data-tier-applications/data-tier-applications?view=sql-server-2017)

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MICROSOFT SQL SERVER IMPORT EXTENSION EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/master/extensions/import/Microsoft_SQL_Server_Import_Extension_and_Tools_Import_Flat_File_Preview.docx).

> Note: Microsoft SQL Server Import for Azure Data Studio extension contains the Microsoft SQL Tools Import Flat File component which is also licensed under the above EULA.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.
