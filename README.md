# KBC Computer Education — Phases 1–4

A standalone Home, About, Courses, Admission, Contact, Results and Notices website for Kaimur Bihar Community Computer Education. Built only with HTML5, CSS3 and vanilla JavaScript. No package installation or build step is required.

## Open locally

Open `index.html` in a browser. For an HTTP preview, run `python -m http.server 8000` from this directory and visit `http://localhost:8000`. Google Fonts requires an internet connection; local sans-serif fallbacks are provided.

## Architecture

- `index.html`: semantic home page and inline, decorative computer workspace illustration.
- `about.html`: institute introduction, learning approach, location and course overview.
- `courses.html`: seven course cards, anchored learning-focus details, native expandable enquiry guidance and call/email enquiry CTA.
- `admission.html`: course selection, student enquiry draft form, basic contact information and admission guidance.
- `contact.html`: contact methods, location area, contact enquiry draft form and social placeholders.
- `results.html`: disconnected result-search interface, honest empty state, possible result information, future-use guidance and enquiry CTA.
- `notices.html`: inactive labeled search/category/date filters, intentional empty notice board, planned categories and an inert notice-card template.
- `js/forms.js`: form validation, course selection, reviewable email drafts and copy-text fallback. Loaded only on the two enquiry pages.
- `css/style.css`: design tokens, foundation, components and section styles.
- `css/responsive.css`: wide, tablet and mobile layouts.
- `css/animations.css`: reveals, hover states and reduced-motion overrides.
- `js/main.js`: mobile menu, scroll state, future-page notices and current copyright year.
- `js/animations.js`: one-time IntersectionObserver reveals and card staggering.
- `assets/images/`, `assets/icons/`, `assets/documents/`: reserved for verified future assets.

## Content and placeholders

About, Courses, Admission, Results, Notices and Contact navigation uses standalone pages. Home-page Learn More, View All Courses, Explore Courses and course-card links lead to the relevant pages or course details. Apply Now opens the student enquiry form. Gallery leads to the explicit future-page note. No admissions are processed by this site.

Telegram and WhatsApp Channel are non-clickable placeholders. Insert verified URLs at the TODO in each footer, replacing the spans with anchors. DTC, DFA and DCTT names are kept as supplied; their full titles, learning focus and syllabuses await confirmation. Course details include email enquiry links; fees, durations and unconfirmed syllabus claims are omitted. About presents the learning approach without inventing a formal mission statement.

## Responsive and accessible behavior

Layout breakpoints: 1440px, 1150px, 1023px, 767px and 424px. Intended viewport checks: 320, 375, 425, 768, 1024, 1280 and 1440 pixels. Navigation collapses below 1024px; course cards change from four to two to one column. Mobile menu supports keyboard navigation, Escape, focus departure and outside click. Hidden navigation is excluded from keyboard access through CSS visibility. A skip link, focus indicators, semantic landmarks and reduced-motion support are included. Content remains available without animation JavaScript.

## GitHub Pages readiness

All project references are relative. Publish the repository root through GitHub Pages when authorized; no deployment has been performed. Future phases can add independent HTML pages and replace anchor placeholders. There is no backend, database, login or dashboard. Header/footer markup is deliberately static so file-based and GitHub Pages navigation works without JavaScript; maintain shared navigation consistently across all seven HTML files.

## Results and Notices publication readiness

Result lookup is deliberately disabled inside a labeled fieldset. There is no database, search request, student record or sample result. Session options await verified published information. The information guide describes possible fields conditionally; it does not promise a confirmed result format.

The notice board contains no published notices. Search/category/date filters are disabled and explained in adjacent text. Category labels do not represent announcements. `notice-card-template` in `notices.html` is an inert HTML template with empty category, date, title and description fields and a Read Notice action without a URL. Populate it only with verified institute content and a real document/page URL. An eventual publication implementation must remove the empty state and activate filters against actual data; this phase contains no simulated filtering or database querying.

## Enquiry forms and location placeholders

The forms prepare drafts locally and never send or store data. Required fields and email format use browser validation; names/messages reject whitespace-only input, and supplied phone numbers must contain 10–15 digits. Admission requires a name, phone and course; email and questions are optional. Contact requires a name, email, subject and message; phone is optional. Only minimal enquiry details are collected.

After preparation, the visitor reviews the draft and explicitly chooses Open Email App to send through their own configured mail client. Copy Text supports webmail; if clipboard access fails, the draft is selected for manual copying. Editing or clearing a form invalidates its previous draft. Without JavaScript, the forms are hidden and phone/email alternatives remain available. No automatic send, success receipt, local storage or submission endpoint exists.

The location area is an explicitly labeled placeholder, not a verified map. Insert a confirmed map link or embed at the TODO in `contact.html`. Telegram and WhatsApp Channel remain non-clickable placeholders. Admission availability, dates, eligibility, fees and document requirements must be confirmed directly with KBC.

## Content maintenance

Use only confirmed institute information. Do not add unverified affiliations, certifications, statistics, testimonials, fees or faculty profiles. The computer visual is an abstract illustration, not a screenshot of an actual KBC learning platform.

## Phase 1 verification

Browser checks at 320, 375, 425, 768, 1024, 1280 and 1440px found no horizontal document overflow. Checked mobile menu opening, Escape closing, link closing, solid header after scrolling, course-anchor navigation, intersection reveals and the Results future-page message. All local stylesheet and script URLs returned HTTP 200, and all internal anchors resolved. No console warnings or errors were captured during these checks. Phone and email targets were inspected without placing a call or sending email. Reduced-motion behavior is implemented in CSS and JavaScript; OS preference switching was not exercised. No deployment or Phase 2 work was performed.

## Phase 2 verification

Both About and Courses passed document-width checks at 320, 375, 425, 768, 1024, 1280 and 1440px. All three pages passed local file/anchor, duplicate-ID and single-H1 audits. Verified seven course cards and seven anchored detail articles, keyboard activation of the Typing Master link, and Enter toggling of the native DTC details disclosure. Shared navigation and the solid interior header were checked in the browser. No console warnings or errors were captured. Phone/email targets were inspected without initiating calls or sending enquiries. Phase 1 mobile hero corrections are retained. No deployment or additional phase was started.

## Phase 3 verification

Admission and Contact passed document-width checks at 320, 375, 425, 768, 1024, 1280 and 1440px. All five pages passed local link/asset, anchor, duplicate-ID and single-H1 audits. Browser checks covered keyboard course selection, empty required fields, invalid phone/email input, whitespace-only messages, valid draft generation, encoded mailto targets, editing invalidating the previous draft, and form reset. The admission draft also fit at 320px. No console errors or warnings were captured. No calls or emails were sent; temporary QA fields were cleared. Clipboard copying and opening an external mail client were not exercised. Map and social links await verification. No deployment or Phase 4 work was performed.

## Phase 4 verification

Results and Notices passed `document.documentElement.scrollWidth <= window.innerWidth` at 320, 375, 425, 768, 1024, 1280 and 1440px. All seven pages passed local file/anchor, field-label, duplicate-ID and single-H1 audits. Browser accessibility snapshots confirmed that result lookup and notice filters are disabled and labeled. Verified the mobile menu with Enter and Escape, keyboard navigation from Notices to Results, empty states, and the absence of rendered notice cards. No console errors or warnings were captured. No result records, student data, session dates or notices were invented. Gallery, map and social URLs remain placeholders. No deployment, backend or Phase 5 work was performed.
