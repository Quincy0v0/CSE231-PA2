const python = require('lezer-python');

const input = `def retTrue(x:int) -> bool:
    return True
print(1)
    `

const tree = python.parser.parse(input);

const cursor = tree.cursor();

cursor.firstChild()
do {
//console.log(cursor.node);
  console.log("-------------------------");
  console.log(cursor.type.name);

  cursor.firstChild()
  do {
  //console.log(cursor.node);
    console.log("--------");
    console.log(cursor.type.name);
  } while(cursor.nextSibling());
  cursor.parent()
} while(cursor.nextSibling());


//do {
//console.log(cursor.node);
//  console.log("--------");
//  console.log(cursor.node.type.name);
//  console.log(input.substring(cursor.node.from, cursor.node.to));
//} while(cursor.next());
