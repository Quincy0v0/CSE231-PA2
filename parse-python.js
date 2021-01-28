const python = require('lezer-python');

const input = `a:int = 1
b:int = 3
c:int = 4
def retTrue(x:int) -> bool:
    return True

def loop(x:int) -> bool:
    while True:
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
