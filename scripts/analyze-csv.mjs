import { readFileSync } from 'fs';

const path = process.argv[2];
const content = readFileSync(path, 'latin1');
const lines = content.split('\r\n').filter(l => l.length > 0);
const header = lines[0];
const row1 = lines[1];

const commas = (row1.match(/,/g)||[]).length;
const semis = (row1.match(/;/g)||[]).length;
const tabs = (row1.match(/\t/g)||[]).length;

console.log('Total lines:', lines.length);
console.log('Delimiter counts — commas:', commas, '| semis:', semis, '| tabs:', tabs);
console.log('\nHeader first 300:', header.substring(0,300));
console.log('\nRow1 first 400:', JSON.stringify(row1.substring(0,400)));
