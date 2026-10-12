import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, daysBetween, displayStatus, invoiceTotals, lineTotal } from './calc.ts'
import type { Invoice } from './types.ts'

const item = (quantity: number, unitPrice: number) => ({ id: 'x', description: '', quantity, unitPrice })

test('lineTotal rounds to cents', () => {
  assert.equal(lineTotal(item(3, 0.1)), 0.3)
  assert.equal(lineTotal(item(1.5, 33.335)), 50)
})

test('invoiceTotals applies discount before tax', () => {
  const t = invoiceTotals({ items: [item(2, 100), item(1, 50)], discountRate: 10, taxRate: 8.25 })
  assert.deepEqual(t, { subtotal: 250, discount: 25, tax: 18.56, total: 243.56 })
})

test('invoiceTotals handles no tax or discount', () => {
  assert.deepEqual(invoiceTotals({ items: [item(1, 19.99)], discountRate: 0, taxRate: 0 }), { subtotal: 19.99, discount: 0, tax: 0, total: 19.99 })
})

test('date helpers cross month and year boundaries', () => {
  assert.equal(addDays('2026-12-15', 30), '2027-01-14')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30)
})

test('displayStatus derives overdue only from sent invoices past due', () => {
  const inv = { status: 'sent', dueDate: '2026-10-01' } as Invoice
  assert.equal(displayStatus(inv, '2026-10-02'), 'overdue')
  assert.equal(displayStatus(inv, '2026-10-01'), 'sent')
  assert.equal(displayStatus({ ...inv, status: 'paid' }, '2026-12-01'), 'paid')
  assert.equal(displayStatus({ ...inv, status: 'draft' }, '2026-12-01'), 'draft')
})
