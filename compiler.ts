import { stringInput } from "lezer-tree";
import {Var_def, Typed_var, Func_def, Func_body, Expr, Stmt, UniOp, BinOp, Literal, Type} from "./ast";
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
  const ast = parse(source);
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
    case "expr":
      return codeGenExpr(stmt.value, env);
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
        `(i32.add )`
      ]));
    case BinOp.Mult:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Div:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Mod:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Equal:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Noteq:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Smeq:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Lgeq:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Sm:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Lg:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
    case BinOp.Is:
      return leftStmts.concat(rightStmts.concat([
        `(i32.add )`
      ]));
  }
}
