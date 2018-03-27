# sp_whoisactive for SQL Operations Studio

Welcome to **sp_whoisactive** for SQL Operations Studio! Sp_whoisactive is a procedure written by Adam Machanic. It is a very useful tool for activity monitoring and troubleshooting.

To quote one of the posts about sp_whoisactive on [Adam Machanic’s blog]:

Here are some quick facts on Who is Active:

  * Who is Active is a DMV-based monitoring stored procedure that uses **15 different views to show a large amount of data about what’s running on your server**
  * Who is Active was designed to be **extremely flexible**, and includes options to not only get different types of data, but also to change the output column list and sort order
  * Who is Active was **designed with performance in mind** at every step; users report that under normal conditions response times are generally subsecond, with slightly longer response times on servers that are extremely taxed
  * Who is Active is **compatible with all versions of SQL Server after SQL Server 2005 RTM**. It does require that the host database (generally master) is not set for SQL Server 2000 compatibility mode

If you haven't installed sp_whoisactive in your server, you can use "Install sp_whoisactive" task to create the procedure. 

See [sp_whoisactive Documentation] for more infomation.

[Adam Machanic’s blog]:http://sqlblog.com/blogs/adam_machanic/default.aspx
[sp_whoisactive Documentation]:http://whoisactive.com/