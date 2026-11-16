const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function extract(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.notEqual(a, -1, 'function start exists');
  assert.notEqual(b, -1, 'function end exists');
  return source.slice(a, b);
}
function sum(items, fn) { return items.reduce((n, x) => n + Number(fn(x) || 0), 0); }
function finance(db, list) {
  const code = extract('function financeTotals(', '\nfunction addExpense');
  return new Function('db', 'sum', code + '; return financeTotals;')(db, sum)(list);
}
function debtHelpers(db) {
  const code = extract('function salePaidTotal(', '\nfunction customersPage');
  return new Function('db', 'sum', code + '; return {salePaidTotal,saleDue,customerBalance};')(db, sum);
}
test('finance report scopes returns to selected invoices', () => {
  const db = { sales: [{id:'a',total:100,cost:40},{id:'b',total:200,cost:80}], returns:[
    {type:'sale',saleId:'a',amount:20,costAmount:8},
    {type:'sale',saleId:'b',amount:50,costAmount:20}
  ], expenses:[{amount:5}] };
  assert.deepEqual(finance(db, [db.sales[0]]), {gross:100,netSales:80,cost:32,saleReturns:20,expenses:5,profit:43});
});
test('whole-ledger report retains legacy returns without invoice IDs', () => {
  const db = { sales:[{id:'a',total:100,cost:40}], returns:[{type:'sale',amount:10,costAmount:4}], expenses:[] };
  assert.equal(finance(db, db.sales).saleReturns, 10);
});
test('payment duplicated in legacy and invoice ledgers is not counted twice', () => {
  const sale = {id:'s1',total:100,paid:40,payments:[{amount:40}]};
  const h = debtHelpers({sales:[sale],customerPayments:[{saleId:'s1',amount:40}]});
  assert.equal(h.salePaidTotal(sale),40);
  assert.equal(h.saleDue(sale),60);
});
test('later customer payment ledger entry updates remaining debt', () => {
  const sale = {id:'s2',total:100,paid:20,payments:[{amount:20}]};
  const h = debtHelpers({sales:[sale],customerPayments:[{saleId:'s2',amount:55}]});
  assert.equal(h.salePaidTotal(sale),55);
  assert.equal(h.saleDue(sale),45);
});

function backupValidator() {
  const code = extract('function validateBackupData(', '\nfunction load');
  return new Function(code + '; return validateBackupData;')();
}
test('backup validator accepts a valid current backup', () => {
  assert.equal(backupValidator()({app:'makhzouni-pro',products:[{name:'Rice',qty:5}],sales:[],purchases:[],settings:{currency:'MAD'}}), true);
});
test('backup validator rejects missing core arrays and malformed optional arrays', () => {
  const validate = backupValidator();
  assert.equal(validate({products:[]}), false);
  assert.equal(validate({products:[],sales:[],returns:{}}), false);
  assert.equal(validate({products:[{name:'Rice',qty:5}],sales:[],settings:[]}), false);
});
test('backup validator rejects a backup belonging to another app', () => {
  assert.equal(backupValidator()({app:'other-app',products:[],sales:[]}), false);
});

test('product editor supports image upload, preview, and removal', () => {
  assert.match(source, /name="imageFile" type="file" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(source, /if\(d\.removeImage==='yes'\)image=''/);
  assert.match(source, /p\.image\?'<img src=/);
  assert.match(source, /imageFile\.size>1024\*1024/);
});
