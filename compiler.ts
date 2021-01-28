import { stringInput } from "lezer-tree";
import {Var_def, Typed_var, Func_def, Func_body, Expr, Stmt, UniOp, BinOp, Literal, Type, Elif, Else} from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  offset: number;
}

export const emptyEnv = { globals: new Map(), offset: 0 };

export function augmentEnv(env: GlobalEnv, stmts: Array<Stmt>) : GlobalEnv {
  const newEnv = new Map(env.globals);
  var newOffset = env.offset;
  stmts.forEach((s) => {
    switch(s.tag) {
      case "define":
        newEnv.set(s.name, newOffset);
        newOffset += 1;
        break;
    }
  })
  return {
    globals: newEnv,
    offset: newOffset
  }
}

type CompileResult = {
  wasmSource: string,
  newEnv: GlobalEnv
};

export function compile(source: string, env: GlobalEnv) : CompileResult {
  const prog = parse(source)
  const ast = prog.stmt; // Program returned here
  const withDefines = augmentEnv(env, ast);
  const commandGroups = ast.map((stmt) => codeGen(stmt, withDefines));
  const commands = [].concat.apply([], commandGroups);
  console.log("Generated: ", commands.join("\n"));
  return {
    wasmSource: commands.join("\n"),
    newEnv: withDefines
  };
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  return (env.globals.get(name) * 4); // 4-byte values
}

function codeGenVar(vardef: Var_def, env: GlobalEnv) : Array<string> {
  let varname = vardef.var.name;
  let varval = codeGenLitr(vardef.value, env);
  let ret = `(local $${varname})
  (local.set $${varname} (i32.const ${varval}))`
  return [ret]
}

function codeGenFunc(funcdef: Func_def, env: GlobalEnv) : Array<string> {
  let params:Array<string> = [];
  let idx = 0;
  funcdef.parameters.forEach(v => {
    params.push(`(param $arg${idx} i32)`);
    idx += 1;
  });
  let ret = "";
  if (funcdef.return!=Type.None) {
    ret = `(result i32)`
  }
  let body = funcdef.body;
  let funcvar:Array<string> = []
  body.def.forEach(element => {
    funcvar.concat(codeGenVar(element, env));
  });
  let funcstmt:Array<string> = []
  body.body.forEach(element => {
    funcstmt.concat(codeGen(element, env));
  })
  let result = `(func $${funcdef.name} ${params} ${ret}
    ${funcvar.toString()}
    ${funcstmt.toString()}
  )`
  return [result]
}

function codeGen(stmt: Stmt, env: GlobalEnv) : Array<string> {
  switch(stmt.tag) {
    case "define":
      const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
      var valStmts = codeGenExpr(stmt.value, env);
      return locationToStore.concat(valStmts).concat([`(i32.store)`]);
    case "print":
      var valStmts = codeGenExpr(stmt.value, env);
      return valStmts.concat([
        "(call $print)"
      ]);
    case "while":
      return ["(call $print)"]
    case "if":
      return ["(call $print)"]
    case "expr":
      const result = codeGenExpr(stmt.value, env);
      result.push("(local.set $scratch)");
      return result;
    case "globals":
      var globalStmts : Array<string> = [];
      env.globals.forEach((pos, name) => {
        globalStmts.push(
            `(i32.const ${pos})`,
            `(i32.const ${envLookup(env, name)})`,
            `(i32.load)`,
            `(call $printglobal)`
          );
      });
      return globalStmts;
  }
}

function codeGenExpr(expr : Expr, env: GlobalEnv) : Array<string> {
  switch(expr.tag) {
    case "lit":
      return codeGenLitr(expr.value, env);
    case "id":
      return [`(i32.const ${envLookup(env, expr.name)})`, `i32.load `]
    case "uniop":
      return codeGenUniOp(expr.op, expr.left, env);
    case "binop":
      return codeGenBinOp(expr.op, expr.left, expr.right, env);
    case "call":
      var valStmts = codeGenExpr(expr.arguments[0], env);
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
  }
}

function codeGenLitr(lit: Literal, env: GlobalEnv): Array<string> {
    switch(lit.tag) {
      case "none":
        return ["(i32.const " + 0 + ")"];
      case "true":
        const bit_true = 1//(1 << 32) + 1
        return ["(i32.const " + bit_true + ")"];
      case "false":
        const bit_false = 0//(1 << 32) + 0
        return ["(i32.const " + bit_false + ")"];
      case "num":
        const bit_num = lit.value//(lit.value << 32) + 2
        return ["(i32.const " + bit_num + ")"];
    }
}

function codeGenUniOp(op: UniOp, left: Expr, env: GlobalEnv): Array<string> {
  var leftStmts = codeGenExpr(left, env);
  switch (op) {
    case UniOp.Not:
      return [`(if (result i32)
            (i32.lt_s` + leftStmts +
            `
              (i32.const 1)
            )
            (then
              (i32.const 1)
            )
            (else
              (i32.const 0)
            )
          )
        `
      ];
    case UniOp.Minus:
      return [`(i32.const 0)`].concat(leftStmts.concat([
        `(i32.sub )`
      ]));
  }
}
function codeGenBinOp(op: BinOp, left: Expr, right: Expr, env: GlobalEnv): Array<string> {
  var leftStmts = codeGenExpr(left, env);
  var rightStmts = codeGenExpr(right, env);

  switch (op) {
    case BinOp.Plus:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Minus:
      return leftStmts.concat(rightStmts.concat([
        `(i32.sub )`
      ]));
    case BinOp.Mult:
      return leftStmts.concat(rightStmts.concat([
        `(i32.mult )`
      ]));
    case BinOp.Div:
      return leftStmts.concat(rightStmts.concat([
        `(i32.div_s )`
      ]));
    case BinOp.Mod:
      return leftStmts.concat(rightStmts.concat([
        `(i32.rem_s )`
      ]));
    case BinOp.Equal:
      return leftStmts.concat(rightStmts.concat([
        `(i32.eq )`
      ]));
    case BinOp.Noteq:
      return leftStmts.concat(rightStmts.concat([
        `(i32.ne )`
      ]));
    case BinOp.Smeq:
      return leftStmts.concat(rightStmts.concat([
        `(i32.le_s )`
      ]));
    case BinOp.Lgeq:
      return leftStmts.concat(rightStmts.concat([
        `(i32.ge_s )`
      ]));
    case BinOp.Sm:
      return leftStmts.concat(rightStmts.concat([
        `(i32.lt_s )`
      ]));
    case BinOp.Lg:
      return leftStmts.concat(rightStmts.concat([
        `(i32.gt_s )`
      ]));
    case BinOp.Is:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
  }
}
