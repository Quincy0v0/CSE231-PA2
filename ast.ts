export type Program = { tag: "program", vardef:  Array<Var_def>, funcdef:  Array<Func_def>, stmt:  Array<Stmt>}

export type Var_def = { tag: "vardef", var: Typed_var, value: Literal }

export type Typed_var = { tag: "typedvar", name: string, type: Type }

export type Func_def = { tag: "funcdef", name: string, parameters: Array<Typed_var>, return: Type , body: Func_body  }

export type Func_body = { tag: "funcbody", def: Array<Var_def>, body: Array<Stmt> }

export type Stmt =
    { tag: "define", name: string, value: Expr }
  | { tag: "if", expr: Expr, body: Array<Stmt>, elif: Elif, else: Else }
  | { tag: "while", expr: Expr, body: Array<Stmt> }
  | { tag: "pass" }
  | { tag: "return", value: Expr }
  | { tag: "expr", value: Expr }
  | { tag: "print", value: Expr }
  | { tag: "globals" }
  | { tag: "vardefstmt", value: Var_def }

export type Elif =
    { tag: "elif", expr: Expr, body: Array<Stmt> }
  | { tag: "noelif"}

export type Else =
    { tag: "else", body: Array<Stmt> }
  | { tag: "noelse"}

export type Expr =
    { tag: "lit", value: Literal }
  | { tag: "id", name: string }
  | { tag: "uniop", op: UniOp, left: Expr }
  | { tag: "binop", op: BinOp, left: Expr, right: Expr }
  | { tag: "parentheses", expr: Expr}
  | { tag: "call", name: string, arguments: Array<Expr> }

export type Literal =
    { tag: "none" }
  | { tag: "true" }
  | { tag: "false" }
  | { tag: "num", value: number }

export enum UniOp { Not, Minus };

export enum BinOp { Plus, Minus, Mult, Div, Mod, Equal, Noteq, Smeq, Lgeq, Sm, Lg, Is };

export enum Type { Int, Bool };
