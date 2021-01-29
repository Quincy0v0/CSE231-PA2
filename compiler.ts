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

export function augmentEnvVar(env: GlobalEnv, vardef: Array<Var_def>) : GlobalEnv {
  const newEnv = new Map(env.globals);
  var newOffset = env.offset;
  vardef.forEach((v) => {
    newEnv.set(v.var.name, newOffset);
    newOffset += 1;
  })
  console.log("augemented env - var", newEnv)
  return {
    globals: newEnv,
    offset: newOffset
  }
}

export function augmentEnvFunc(env: GlobalEnv, funcdef: Array<Func_def>) : GlobalEnv {
  const newEnv = new Map(env.globals);
  let newOffset = env.offset;
  funcdef.forEach((f) => {
    // add parameters
    f.parameters.forEach((v, idx) => {
      newEnv.set(f.name+'param'+idx, newOffset);
      newOffset += 1;
    });
    // add function local variables
    f.body.def.forEach((v) => {
      newEnv.set(v.var.name, newOffset);
      newOffset += 1;
    });
  })
  console.log("augemented env - func", newEnv)
  return {
    globals: newEnv,
    offset: newOffset
  }
}

type CompileResult = {
  varSource: string,
  funcSource: string,
  wasmSource: string,
  newEnv: GlobalEnv
};

export function compile(source: string, env: GlobalEnv) : CompileResult {
  const prog = parse(source)
  const ast_var = prog.vardef;
  const ast_func = prog.funcdef;
  const ast_stmt = prog.stmt;
  let withDefines = augmentEnvVar(env, ast_var);
  withDefines = augmentEnvFunc(withDefines, ast_func);
  withDefines = augmentEnv(withDefines, ast_stmt);
  console.log("global env =", withDefines)

  let commandGroups = ast_func.map((func) => codeGenFunc(func, withDefines));
  let commands_func = [].concat.apply([], commandGroups);

  commandGroups = ast_stmt.map((stmt) => codeGen(stmt, withDefines));
  let commands_stmt = [].concat.apply([],commandGroups);

  commandGroups = ast_var.map((elem) => codeGenVar(elem, withDefines));
  let commands_var = [].concat.apply([],commandGroups);

  //console.log("Generated: ", commands.join("\n"));
  return {
    varSource: commands_var.join("\n"),
    funcSource: commands_func.join("\n"),
    wasmSource: commands_stmt.join("\n"),
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
  const locationToStore = [`(i32.const ${envLookup(env, varname)})`];
  return locationToStore.concat(varval).concat([`(i32.store)`]);
}

function codeGenParam(val: Array<string>, name: string, idx:number, env: GlobalEnv) : Array<string> {
  let varname = name+'param'+idx;
  const locationToStore = [`(i32.const ${envLookup(env, varname)})`];
  return locationToStore.concat(val).concat([`(i32.store)`]);
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
  // add parameters here
  body.def.forEach(element => {
    funcvar = funcvar.concat(codeGenVar(element, env));
  });
  let funcstmt:Array<string> = []
  body.body.forEach(element => {
    funcstmt = funcstmt.concat(codeGen(element, env));
  })
  let result = `(func $${funcdef.name} ${params} ${ret}
    ${funcvar.join("")}
    ${funcstmt.join("")}
  )`
  return [result]
}

function codeGen(stmt: Stmt, env: GlobalEnv) : Array<string> {
  switch(stmt.tag) {
    case "define":
      const locationToStore = [`(i32.const ${envLookup(env, stmt.name)})`];
      var valStmts = codeGenExpr(stmt.value, env);
      return locationToStore.concat(valStmts).concat([`(i32.store)`]);
    case "print":
      var valStmts = codeGenExpr(stmt.value, env);
      return valStmts.concat([
        "(call $print)"
      ]);
    case "while":
      let while_body:Array<string> = [];
      let while_expr = codeGenExpr(stmt.expr, env);
      stmt.body.forEach((b) => {
        while_body = while_body.concat(codeGen(b, env));
      });
      return [`(block
      (loop
        ${while_body.join("")}
      (br_if 1 ${while_expr.join("")})
      (br 0)))`]
    case "if":
      return ["(call $print)"]
    case "return":
      let val = codeGenExpr(stmt.value, env);
      return val;
    case "expr":
      return codeGenExpr(stmt.value, env).concat(["(local.set $scratch)"]);
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
      let param = codeGenParam(valStmts, expr.name, 0, env);
      valStmts.push(`(call $${expr.name})`);
      return param.concat(valStmts);
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
