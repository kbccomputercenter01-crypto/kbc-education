/* Shared validation/routes. Roles are read from RLS-protected profiles, never metadata. */
((root) => {
  'use strict';
  const dashboard = (role) => role === 'student' ? 'student-dashboard.html' : role === 'teacher' ? 'teacher-dashboard.html' : null;
  const normalizePhone = (value) => value.replace(/\D/g, '');
  const validPhone = (value) => /^[+\d\s().-]+$/.test(value) && /^\d{10,15}$/.test(normalizePhone(value));
  const strongPassword = (value) => value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
  const registration = ({ fullName, email, phone, password, confirm }) => {
    if (!fullName.trim() || fullName.trim().length > 80) return 'Enter your full name (up to 80 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) return 'Enter a valid email address.';
    if (!validPhone(phone)) return 'Enter a mobile number with 10 to 15 digits.';
    if (!strongPassword(password)) return 'Use 12–128 characters, including uppercase, lowercase, and a number.';
    if (password !== confirm) return 'Passwords do not match.';
    return '';
  };
  const value = Object.freeze({ dashboard, normalizePhone, validPhone, strongPassword, registration });
  if (typeof module !== 'undefined' && module.exports) module.exports = value;
  else root.KBCAuthRules = value;
})(typeof window === 'undefined' ? globalThis : window);
