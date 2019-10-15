/**
 * @name No floating promises
 * @kind problem
 * @problem.severity error
 * @id js/experimental/floating-promise
 */
import javascript

private predicate isEscapingPromise(PromiseDefinition promise) {
  exists (DataFlow::Node escape | promise.flowsTo(escape) |
    escape = any(DataFlow::InvokeNode invk).getAnArgument()
    or
    escape = any(DataFlow::FunctionNode fun).getAReturn()
    or
    escape = any(ThrowStmt t).getExpr().flow()
    or
    escape = any(GlobalVariable v).getAnAssignedExpr().flow()
    or
    escape = any(DataFlow::PropWrite write).getRhs()
    or
    exists(WithStmt with, Assignment assign |
      with.mayAffect(assign.getLhs()) and
      assign.getRhs().flow() = escape
    )
  )
}

from PromiseDefinition promise
where
  not exists(promise.getAMethodCall(any(string m | m = "then" or m = "catch" or m = "finally"))) and
  not exists (AwaitExpr e | promise.flowsTo(e.getOperand().flow())) and
  not isEscapingPromise(promise)
select promise, "This promise appears to be a floating promise"
