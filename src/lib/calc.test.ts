import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, addMonths, daysBetween, displayStatus, invoiceTotals, lineTotal, recurringIssueDate } from './calc.ts'
import type { Invoice } from './types.ts'

const item = (quantity: number, unitPrice: number, taxRate = 0) => ({ quantity, unitPrice, taxRate })

test('lineTotal rounds to cents', () => {
  assert.equal(lineTotal(item(3, 0.1)), 0.3)
  assert.equal(lineTotal(item(1.5, 33.335)), 50)
})

test('invoiceTotals: per-line tax on the discounted amount', () => {
  const t = invoiceTotals({ items: [item(2, 100, 8.25), item(1, 50, 8.25)], discountRate: 10 })
  assert.deepEqual(t, { subtotal: 250, discount: 25, tax: 18.56, total: 243.56 })
})

test('invoiceTotals: mixed tax rates', () => {
  const t = invoiceTotals({ items: [item(1, 100, 13), item(1, 100, 0)], discountRate: 0 })
  assert.deepEqual(t, { subtotal: 200, discount: 0, tax: 13, total: 213 })
})

test('invoiceTotals: no tax or discount', () => {
  assert.deepEqual(invoiceTotals({ items: [item(1, 7250)], discountRate: 0 }), { subtotal: 7250, discount: 0, tax: 0, total: 7250 })
})

test('date helpers cross month and year boundaries', () => {
  assert.equal(addDays('2026-12-15', 30), '2027-01-14')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30)
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29')
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28')
})

test('recurringIssueDate matches the SQL schedule (anchored, no month-end drift)', () => {
  // Same series the Postgres function produced in testing.
  const got = [0, 1, 2, 3, 8, 9].map((p) => recurringIssueDate('2026-01-31', 'month', 1, p))
  assert.deepEqual(got, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-09-30', '2026-10-31'])
  assert.equal(recurringIssueDate('2026-01-01', 'week', 2, 2), '2026-01-29')
  assert.equal(recurringIssueDate('2028-02-29', 'year', 1, 1), '2029-02-28')
})

test('displayStatus derives overdue only from sent invoices past due', () => {
  const inv = { status: 'sent', dueDate: '2026-10-01' } as Invoice
  assert.equal(displayStatus(inv, '2026-10-02'), 'overdue')
  assert.equal(displayStatus(inv, '2026-10-01'), 'sent')
  assert.equal(displayStatus({ ...inv, status: 'paid' }, '2026-12-01'), 'paid')
  assert.equal(displayStatus({ ...inv, status: 'void' }, '2026-12-01'), 'void')
})
