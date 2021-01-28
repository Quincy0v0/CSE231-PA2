1. A description of the representation of values (integers, booleans, and None) in your implementation. Give examples, and explain why it is necessary to do so.
I use an i64 to represent a variable. The first 32 bits of this i64 is the actual value of the variable, and the second 32 bits is the metadata.
For the metadata, we use the most significant two bits to defind the datatype.
00 means None
01 means Boolean
10 means Number (positive)
11 means Number (negative)

For the other 32 bits that indicates the actual value,
for None type this is 0
for Numbers this is the binary representation of the actual number
for Booleans, we only use the most significant bit. 0 means False and 1 means True.

2.Give an example of a program that uses
At least one global variable
At least one function with a parameter
At least one variable defined inside a function
By linking to specific definitions and code in your implementation, describe where and how those three variables are stored and represented throughout compilation.

3.Write a Python program that goes into an infinite loop. What happens when you run it on the web page using your compiler?

4.For each of the following scenarios, show a screenshot of your compiler running the scenario. If your compiler cannot handle the described scenario, write a few sentences about why.
A function defined in the main program and later called from the interactive prompt
A function defined at the interactive prompt, whose body contains a call to a function from the main program, called at a later interactive prompt
A program that has a type error because of a mismatch of booleans and integers on one of the arithmetic operations
A program that has a type error in a conditional position
A program that calls a function from within a loop
Printing an integer and a boolean
A recursive function.
Two mutually-recursive functions.