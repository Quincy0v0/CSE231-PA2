const python = require('lezer-python');

const input = `a:int = 1
b:int = 3
c:int = 4
def is_even(x:int) -> bool:
    if x % 2 == 1:
        return False
    elif x % 2 == -1:
        return False
    else:
        return True`
const tree = python.parser.parse(input);
const cursor = tree.cursor();

function vizTree(cursor, s, depth) {
    console.log (Array(depth * 2 + 1).join(" ") + `> [${cursor.node.type.name}]: '${s.substring(cursor.from, cursor.to)}'`)
    if (!cursor.firstChild()) {
        return;
    }
    do {
        vizTree(cursor, s, depth * 2 + 1);
    } while (cursor.nextSibling());

    cursor.parent();
}

vizTree(cursor, input, 0);
