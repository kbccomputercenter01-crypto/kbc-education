/* Client-side draft preparation only: no submission endpoint or data storage. */
(() => {
  'use strict';
  const recipient = 'kaimurbiharcommunity@gmail.com';
  document.querySelectorAll('.enquiry-form').forEach((form) => {
    form.hidden = false;
    const kind = form.dataset.enquiry;
    const prefix = kind === 'admission' ? 'student' : 'contact';
    const field = (name) => form.elements.namedItem(`${prefix}-${name}`);
    const panel = form.querySelector('.draft-panel');
    const text = form.querySelector('.draft-text');
    const email = form.querySelector('.draft-email');
    const status = form.querySelector('.form-status');
    const clearDraft = () => {
      panel.hidden = true;
      text.value = '';
      email.removeAttribute('href');
      status.textContent = '';
    };
    form.addEventListener('input', (event) => {
      if (event.target.matches('input, select, textarea') && !event.target.readOnly) {
        event.target.setCustomValidity('');
        clearDraft();
      }
    });
    form.addEventListener('change', clearDraft);
    form.addEventListener('reset', () => {
      [...form.elements].forEach((element) => element.setCustomValidity?.(''));
      clearDraft();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      [...form.elements].filter((element) => element.required).forEach((element) => {
        element.setCustomValidity(element.value.trim() ? '' : 'Please complete this field.');
      });
      const phone = field('phone');
      const phoneText = phone.value.trim();
      const digits = phoneText.replace(/\D/g, '');
      if (phoneText && (!/^[+\d\s().-]+$/.test(phoneText) || digits.length < 10 || digits.length > 15)) {
        phone.setCustomValidity('Please enter a phone number with 10 to 15 digits.');
      }
      if (!form.reportValidity()) return;
      const course = kind === 'admission' ? field('course').value : null;
      const subject = kind === 'admission' ? `Admission enquiry — ${course}` : field('subject').value;
      const message = form.elements.namedItem(`${kind}-message`).value.trim();
      const lines = [
        'Hello KBC Computer Education,', '',
        `Name: ${field('name').value.trim()}`,
        `Phone: ${phoneText || 'Not provided'}`,
        `Email: ${field('email').value.trim() || 'Not provided'}`,
        kind === 'admission' ? `Course of interest: ${course}` : `Subject: ${subject}`,
        '', message || 'Please share the course and admission information.', '',
        'Thank you.'
      ];
      text.value = `To: ${recipient}\nSubject: ${subject}\n\n${lines.join('\n')}`;
      email.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      panel.hidden = false;
      status.textContent = 'Draft prepared. Review it below. Your enquiry has not been sent.';
      panel.focus({ preventScroll: false });
    });
    form.querySelector('.copy-draft').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text.value);
        status.textContent = 'Draft copied. Paste it into your email app to send it to KBC.';
      } catch {
        text.focus();
        text.select();
        status.textContent = 'Select and copy the draft text, then paste it into your email app.';
      }
    });
  });
  document.querySelectorAll('[data-course-choice]').forEach((link) => {
    link.addEventListener('click', () => {
      const select = document.querySelector('#student-course');
      if (!select) return;
      select.value = link.dataset.courseChoice;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.focus({ preventScroll: true });
    });
  });
})();
