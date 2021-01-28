import {parser} from "lezer-python";
import {Tree, TreeCursor} from "lezer-tree";
import {Program, Var_def, Typed_var, Func_def, Func_body, Expr, Stmt, UniOp, BinOp, Literal, Type, Elif, Else} from "./ast";

export function getUniOp(opstr : string) : UniOp {
  switch(opstr) {
    case "not":
      return UniOp.Not;
    case "-":
      return UniOp.Minus;
  }
}

export function getBinOp(opstr : string) : BinOp {
  switch(opstr) {
    case "+":
      return BinOp.Plus;
    case "-":
      return BinOp.Minus;
    case "*":
      return BinOp.Mult;
    case "//":
      return BinOp.Div;
    case "%":
      return BinOp.Mod;
    case "==":
      return BinOp.Equal;
    case "!=":
      return BinOp.Noteq;
    case "<=":
      return BinOp.Smeq;
    case ">=":
      return BinOp.Lgeq;
    case "<":
      return BinOp.Sm;
    case ">":
      return BinOp.Lg;
    case "is":
      return BinOp.Is;
  }
}

export function traverseParameters(c : TreeCursor, s : string) : Array<Typed_var> {
  c.firstChild();  // Focuses on open paren
  let result: Typed_var[] = [];
  while (c.nextSibling() && c.type.name==="VariableName") { // Focuses on a VariableName
    let name = s.substring(c.from, c.to);
    c.nextSibling(); // Focuses on TypeDef
    c.firstChild(); // Focus on type
    c.nextSibling();
    let typestr = s.substring(c.from, c.to);
    let type = Type.Int;
    if (typestr==="int") {
      type = Type.Int;
    }
    else if (typestr==="bool") {
      type = Type.Bool;
    }
    else {
      throw new Error("Could not parse paramList at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
    result.push({
      tag: "typedvar",
      name: name,
      type: type
    });
    c.parent(); // Pop to TypeDef
    c.nextSibling(); // Focus on ',' if any
  }
  c.parent();      // Pop to ParamList
  return result
}

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  console.log(c.type.name)
  switch(c.type.name) {
    case "Number":
      return {
        tag: "lit",
        value: traverseLitr(c, s)
      }
    case "Boolean":
      return {
        tag: "lit",
        value: traverseLitr(c, s)
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "CallExpression":
      c.firstChild() // focus on variable name
      let callName = s.substring(c.from, c.to);
      console.log(callName)
      c.nextSibling(); // go to arglist
      console.log(c.type.name, s.substring(c.from, c.to))
      c.firstChild(); // go into arglist, focus on (
      console.log(c.type.name, s.substring(c.from, c.to))
      c.nextSibling(); // focus on arg1
      console.log(c.type.name, s.substring(c.from, c.to))
      const args: Array<Expr> = []
      do {
        args.push(traverseExpr(c, s));
        c.nextSibling();
      } while(c.nextSibling())
      console.log("args ready", args)
      c.parent(); // pop arglist
      c.parent(); // pop expressionstmt
      return {
        tag: "call",
        name: callName,
        arguments: args
      };
    case "UnaryExpression":
      c.firstChild();
      const uopstr = s.substring(c.from, c.to);
      c.nextSibling(); // Here we would look at this value to get the operator
      const variable = traverseExpr(c, s);
      c.parent();
      return {
        tag: "uniop",
        op: getUniOp(uopstr),
        left: variable,
      }
    case "BinaryExpression":
      c.firstChild();
      const left = traverseExpr(c, s);
      c.nextSibling(); // Here we would look at this value to get the operator
      const opstr = s.substring(c.from, c.to);
      c.nextSibling();
      const right = traverseExpr(c, s);
      c.parent();
      return {
        tag: "binop",
        op: getBinOp(opstr),
        left: left,
        right: right
      }
    case "ParenthesizedExpression":
      c.firstChild(); // focus on '('
      c.nextSibling(); // focus on expr
      const pexpr = traverseExpr(c, s);
      c.nextSibling();// focus on ')'
      c.parent();
      return {
        tag: "parentheses",
        expr: pexpr,
      }
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

function traverseLitr(c : TreeCursor, s : string) : Literal {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }
    case "None":
      return {
        tag: "none"
      }
    case "Boolean":
      if (s.substring(c.from, c.to) === "True") {
        return {
          tag: "true"
        }
      } else {
        return {
          tag: "false"
        }
      }
    default:
      throw new Error("Could not parse Literal at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseVardef(c : TreeCursor, s : string) : Array<Var_def> {
  let def: Var_def[] = [];
  while (c.type.name=="AssignStatement") {
    c.firstChild(); // Focus on variable name
    let name = s.substring(c.from, c.to);
    c.nextSibling(); // Focus on TypeDef
    c.firstChild(); // Focus on :
    c.nextSibling(); // Focus on type
    let type = s.substring(c.from, c.to);
    c.parent();
    c.nextSibling(); // Focus on =
    c.nextSibling(); // Focus on value
    let value = traverseLitr(c, s);
    let typeenum = type=="int" ? Type.Int : Type.Bool;
    let tpvar:Typed_var = { tag: "typedvar", name: name, type: typeenum };
    def.push({
      tag: "vardef",
      var: tpvar,
      value: value
    })
    c.parent();
    if (!c.nextSibling()) {
      break
    }
  }
  return def
}

export function traverseFuncbody(c : TreeCursor, s : string) : Func_body {
  let body: Stmt[] = [];
  let def: Array<Var_def> = traverseVardef(c, s);
  do {
    body.push(traverseStmt(c, s))
  } while (c.nextSibling());
  return {
    tag: "funcbody",
    def: def,
    body: body
  }
}

export function traverseFuncdef(c : TreeCursor, s : string) : Array<Func_def> {
  let def: Array<Func_def> = [];
  while (c.type.name=="FunctionDefinition") {
    c.firstChild(); // Focus on def
    c.nextSibling(); // Focus on name of function
    var name = s.substring(c.from, c.to);
    c.nextSibling(); // Focus on ParamList
    var parameters = traverseParameters(c, s)
    c.nextSibling(); // Focus on Body or return type
    let tp = c.type.name;
    let retType = Type.None;
    if (tp != "Body") {
      c.firstChild();  // Focus on return type
      retType = s.substring(c.from, c.to)=="int" ? Type.Int : Type.Bool;
      c.parent();
      c.nextSibling(); // Focus on Body
    }
    c.firstChild();  // Focus on :
    c.nextSibling(); // Focus on single statement (for now)
    var body = traverseFuncbody(c, s);
    c.parent();      // Pop to Body
    c.parent();      // Pop to FunctionDefinition
    def.push({
      tag: "funcdef",
      name: name,
      parameters: parameters,
      return: retType,
      body: body
    })
    if (!c.nextSibling()) {
      break
    }
  }
  return def
}

export function traverseElif(c : TreeCursor, s : string) : Elif {
  c.nextSibling(); // focus on expr
  let expr = traverseExpr(c, s);
  c.nextSibling(); // focus on body
  c.firstChild(); // focus on :
  c.nextSibling(); // focus on expr
  const body: Array<Stmt> = [];
  do {
    body.push(traverseStmt(c, s));
  } while(c.nextSibling())
  c.parent(); // pop back to body
  c.nextSibling(); // move to else / end if
  return {
    tag: "elif",
    expr: expr,
    body: body
  }
}

export function traverseElse(c : TreeCursor, s : string) : Else {
    c.nextSibling(); // focus on body
    c.firstChild(); // focus on :
    c.nextSibling(); // focus on expr
    const body: Array<Stmt> = [];
    do {
      body.push(traverseStmt(c, s));
    } while(c.nextSibling())
    c.parent(); // pop back to body
    c.nextSibling(); // move to else / end if
    return {
      tag: "else",
      body: body
    }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      let name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      let value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild(); // focus on CallExpression
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return {
        tag: "expr",
        value: expr
      }
    case "FunctionDefinition":
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
    case "IfStatement":
      c.firstChild(); // Focus on if
      c.nextSibling(); // focus on the expr
      const ifexpr = traverseExpr(c, s);
      c.nextSibling(); // focus on body
      c.firstChild(); // focus on :
      c.nextSibling(); // focus on expr
      const body: Array<Stmt> = [];
      do {
        body.push(traverseStmt(c, s));
      } while(c.nextSibling())
      c.parent(); // pop back to body
      c.nextSibling(); // move to elif/else/end
      let elifdata: Elif = { tag: "noelif" };
      let elsedata: Else = { tag: "noelse" };
      if (c.type.name=="elif") {
        elifdata = traverseElif(c, s);
      }
      if (c.type.name=="else") {
        elsedata = traverseElse(c, s);
      }
      return {
        tag: "if",
        expr: ifexpr,
        body: body,
        elif: elifdata,
        else: elsedata
      }
    case "WhileStatement":
      c.firstChild(); // Focus on while
      c.nextSibling(); // Focus on expr
      let whileexpr = traverseExpr(c, s);
      c.nextSibling(); // Focus on body
      c.firstChild(); // focus on :
      c.nextSibling(); // focus on expr
      const whilebody: Array<Stmt> = [];
      do {
        whilebody.push(traverseStmt(c, s));
      } while(c.nextSibling())
      c.parent(); // pop back to body
      c.parent(); // pop back to stmt
      return {
        tag: "while",
        expr: whileexpr,
        body: whilebody
      }
    case "PassStatement":
      return {
        tag: "pass"
      }
    case "ReturnStatement":
      c.firstChild();  // Focus return keyword
      c.nextSibling(); // Focus expression
      let retvalue = traverseExpr(c, s);
      c.parent();
      return { tag: "return", value: retvalue };
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Program {
  switch(c.node.type.name) {
    case "Script":
      const firstChild = c.firstChild();
      const vardef = traverseVardef(c, s)
      console.log(vardef)
      console.log(c.type.name)
      console.log("-----parse variable def complete-----")
      const funcdef = traverseFuncdef(c, s)
      console.log(funcdef)
      console.log(c.type.name)
      console.log("-----parse function def complete-----")
      const stmts = [];
      console.log(c.type.name)
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      console.log("-------------------------------------")
      console.log(stmts)
      return {
        tag: "program",
        vardef: vardef,
        funcdef: funcdef,
        stmt: stmts
      };
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}

export function parse(source : string) : Program {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
