import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenAmount } from '../utils/parseSpokenAmount.js';

describe('parseSpokenAmount Unit Tests', () => {
  // Required 10 test cases from prompt
  test('parses "teen sau saath" to 360', () => {
    const res = parseSpokenAmount('teen sau saath');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('parses "तीन सौ साठ" to 360', () => {
    const res = parseSpokenAmount('तीन सौ साठ');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('parses "three hundred sixty" to 360', () => {
    const res = parseSpokenAmount('three hundred sixty');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('parses "dedh sau" to 150', () => {
    const res = parseSpokenAmount('dedh sau');
    assert.equal(res.valid, true);
    assert.equal(res.value, 150);
  });

  test('parses "dhai sau" to 250', () => {
    const res = parseSpokenAmount('dhai sau');
    assert.equal(res.valid, true);
    assert.equal(res.value, 250);
  });

  test('parses "do hazaar paanch sau" to 2500', () => {
    const res = parseSpokenAmount('do hazaar paanch sau');
    assert.equal(res.valid, true);
    assert.equal(res.value, 2500);
  });

  test('parses "₹450" to 450', () => {
    const res = parseSpokenAmount('₹450');
    assert.equal(res.valid, true);
    assert.equal(res.value, 450);
  });

  test('parses "३६०" to 360', () => {
    const res = parseSpokenAmount('३६०');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('rejects "ek lakh" as out of range', () => {
    const res = parseSpokenAmount('ek lakh');
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'OUT_OF_RANGE');
  });

  test('rejects "kuch bhi" as not a number', () => {
    const res = parseSpokenAmount('kuch bhi');
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'NOT_A_NUMBER');
  });

  // Additional extensive test cases (total > 25 phrases)
  test('parses "360 rupaye" to 360', () => {
    const res = parseSpokenAmount('360 rupaye');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('parses "Rs 360" to 360', () => {
    const res = parseSpokenAmount('Rs 360');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('parses "saade teen sau" to 350', () => {
    const res = parseSpokenAmount('saade teen sau');
    assert.equal(res.valid, true);
    assert.equal(res.value, 350);
  });

  test('parses "paanch sau" to 500', () => {
    const res = parseSpokenAmount('paanch sau');
    assert.equal(res.valid, true);
    assert.equal(res.value, 500);
  });

  test('parses "ek hazaar" to 1000', () => {
    const res = parseSpokenAmount('ek hazaar');
    assert.equal(res.valid, true);
    assert.equal(res.value, 1000);
  });

  test('parses "360 rupees" to 360', () => {
    const res = parseSpokenAmount('360 rupees');
    assert.equal(res.valid, true);
    assert.equal(res.value, 360);
  });

  test('parses "dedh hazaar" to 1500', () => {
    const res = parseSpokenAmount('dedh hazaar');
    assert.equal(res.valid, true);
    assert.equal(res.value, 1500);
  });

  test('parses "dhai hazaar" to 2500', () => {
    const res = parseSpokenAmount('dhai hazaar');
    assert.equal(res.valid, true);
    assert.equal(res.value, 2500);
  });

  test('parses "saade chaar sau rupaye" to 450', () => {
    const res = parseSpokenAmount('saade chaar sau rupaye');
    assert.equal(res.valid, true);
    assert.equal(res.value, 450);
  });

  test('takes the last number when speaker corrects: "teen sau nahi chaar sau"', () => {
    const res = parseSpokenAmount('teen sau nahi chaar sau');
    assert.equal(res.valid, true);
    assert.equal(res.value, 400);
  });

  test('takes the last number when speaker says: "300 ya 450 chalega"', () => {
    const res = parseSpokenAmount('300 ya 450 chalega');
    assert.equal(res.valid, true);
    assert.equal(res.value, 450);
  });

  test('rejects numbers below minimum (e.g. 20 < 50)', () => {
    const res = parseSpokenAmount('twenty rupees');
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'OUT_OF_RANGE');
  });

  test('accepts minimum boundary Rs 50', () => {
    const res = parseSpokenAmount('pachaas rupaye');
    assert.equal(res.valid, true);
    assert.equal(res.value, 50);
  });

  test('accepts maximum boundary Rs 20000', () => {
    const res = parseSpokenAmount('bees hazaar');
    assert.equal(res.valid, true);
    assert.equal(res.value, 20000);
  });

  test('rejects numbers above maximum (e.g. 25000 > 20000)', () => {
    const res = parseSpokenAmount('pachhees hazaar');
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'OUT_OF_RANGE');
  });

  test('parses Devanagari "चार सौ पचास" to 450', () => {
    const res = parseSpokenAmount('चार सौ पचास');
    assert.equal(res.valid, true);
    assert.equal(res.value, 450);
  });
});
