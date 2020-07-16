# SQL Assessment *(preview)*

SQL Assessment for Azure Data Studio provides a mechanism to evaluate the configuration of SQL Server for best practices. It uses [SQL Assessment API](https://techcommunity.microsoft.com/t5/sql-server/released-sql-assessment-api-ga/ba-p/989677) to achieve this. With this preview version, you can:

- Assess a SQL Server or Azure SQL Managed Instance and its databases with built-in rules (Invoke Assessment)
- Get a list of all built-in rules applicable to an instance and its databases (View applicable rules)
- Export assessment results and list of applicable rules as script to further store it in a SQL table

![SqlAssessmentPic](https://user-images.githubusercontent.com/61055430/87181263-ad121280-c2ea-11ea-9361-19fa6d3c1ea1.png)

### How do I start SQL Assessment?
SQL Assessment adds its own tab on the main dashboard – you will find it in the General section after installing the extension. Pick the tab and click “Invoke Assessment” to assess the current SQL Server instance and all its databases. Once the results on the grid, you can use the filtering and sorting features of the column headers to display them your own way. Click “Export as Script” to get the results in an insert-into-table format on a new tab.

If the dashboard is opened for a database, the “Invoke Assessment” button runs an assessment for this database only.

Some assessment rules are for particular SQL Server configurations and some for others. The same is true for database rules. For example, there are rules that are applicable only to SQL Server 2016 or the tempdb database. “View applicable rules” button displays those assessment rules that this current object, either a server or database, will be checked by, when you click “Invoke Assessment.”

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
