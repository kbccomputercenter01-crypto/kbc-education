// Unit checks only; these do not sign in, create accounts, or prove live RLS.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const rules = require('../js/auth-rules.js');
const password = () => `Aa1${randomBytes(18).toString('hex')}`;

test('routes only the supported student/teacher roles', () => {
  assert.equal(rules.dashboard('student'), 'student-dashboard.html');
  assert.equal(rules.dashboard('teacher'), 'teacher-dashboard.html');
  for (const role of ['admin', 'owner', '', undefined, '__proto__', 'constructor']) {
    assert.equal(rules.dashboard(role), null);
  }
});
test('phone validation normalizes formatting but rejects text and incorrect lengths', () => {
  assert.equal(rules.validPhone('+91 90067 79137'), true);
  assert.equal(rules.normalizePhone('+91 90067 79137'), '919006779137');
  assert.equal(rules.validPhone('letters 9006779137'), false);
  assert.equal(rules.validPhone('123'), false);
  assert.equal(rules.validPhone('1'.repeat(16)), false);
});
test('registration rejects blank names, malformed emails, weak/mismatched passwords', () => {
  const pwd = password();
  const input = { fullName: 'Validation only', email: 'validation@example.com', phone: '9006779137', password: pwd, confirm: pwd };
  assert.equal(rules.registration(input), '');
  assert.match(rules.registration({ ...input, fullName: ' ' }), /full name/);
  assert.match(rules.registration({ ...input, fullName: 'x'.repeat(81) }), /full name/);
  assert.match(rules.registration({ ...input, email: 'invalid' }), /email/);
  assert.match(rules.registration({ ...input, phone: '123' }), /mobile/);
  assert.match(rules.registration({ ...input, password: randomBytes(6).toString('hex') }), /uppercase/);
  assert.match(rules.registration({ ...input, confirm: password() }), /match/);
});
test('password bounds and character categories apply independently', () => {
  assert.equal(rules.strongPassword(password()), true);
  assert.equal(rules.strongPassword('a'.repeat(12)), false);
  assert.equal(rules.strongPassword('A'.repeat(12)), false);
  assert.equal(rules.strongPassword('1'.repeat(12)), false);
  assert.equal(rules.strongPassword('Aa1'), false);
  assert.equal(rules.strongPassword('Aa1' + 'x'.repeat(126)), false);
});
