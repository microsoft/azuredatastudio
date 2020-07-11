# sp_whoisactive for Azure Data Studio

Welcome to **sp_whoisactive** for Azure Data Studio! Sp_whoisactive is a procedure written by Adam Machanic, a Microsoft MVP for SQL Server. It is a very useful tool for activity monitoring and troubleshooting. This extension provides the insights provided by this tool as graphs and tasks inside a Azure Data Studio dashboard extension.

## Tasks and insights:

<img src="https://github.com/Microsoft/azuredatastudio/raw/main/samples/sp_whoIsActive/images/insights_section.png" alt="insights" style="width:480px;"/>

Details:

<img src="https://github.com/Microsoft/azuredatastudio/raw/main/samples/sp_whoIsActive/images/insights_details_section.png" alt="insights" style="width:240px;"/>


## Why use sp_whoisactive?
Here are some quick facts on Who is Active from [Adam Machanic’s blog]:

  * Who is Active is a DMV-based monitoring stored procedure that uses **15 different views to show a large amount of data about what’s running on your server**
  * Who is Active was designed to be **extremely flexible**, and includes options to not only get different types of data, but also to change the output column list and sort order
  * Who is Active was **designed with performance in mind** at every step; users report that under normal conditions response times are generally subsecond, with slightly longer response times on servers that are extremely taxed
  * Who is Active is **compatible with all versions of SQL Server after SQL Server 2005 RTM**. It does require that the host database (generally master) is not set for SQL Server 2000 compatibility mode

## Documentation:
If you haven't installed sp_whoisactive in your server, you can use the "Install sp_whoisactive" task to create the procedure.

See [sp_whoisactive Documentation] for more infomation.

## Building your own insights and tasks
This extension is also useful as a sample dashboard extension. It demonstrates building a dedicated dashboard extension with a set of insights and tasks built in. You can get started building your own extension by following the [extension authoring guide].

See [sp_whoisactive extension project] in the Azure Data Studio for the extension source code.

[Adam Machanic’s blog]:http://sqlblog.com/blogs/adam_machanic/default.aspx
[sp_whoisactive Documentation]:http://whoisactive.com/
[sp_whoisactive extension project]:https://github.com/Microsoft/azuredatastudio/tree/main/samples/sp_whoIsActive
[extension authoring guide]:https://github.com/Microsoft/azuredatastudio/wiki/Getting-started-with-Extensibility

## Contributions and "thank you"
Special thank to Adam Machanic for partnering with us and make this sp_whoisactive extension possible.

## What's new in Server Reports v1.1?
* Changed CPU usage, CPU delta, memory usage, memory delta to show only top 10 data
* Added details option on each chart to display details of data entries
* Improved "Get plans" and "Find leader of block" tasks. The tasks will open new editor, configure current dashboard connection, and run the query.

## How to produce an extension installation package
Run the following commands sequentially in the context of this directory:
- `yarn install` - to install the dependencies
- `yarn build` - to build the code
- `vsce package` - to produce an extension installation package
