/* MyWeek · página-anuncio: idioma ES/EN, WhatsApp con mensaje por botón, contadores, galería y demo al llegar. */
(function () {
  document.documentElement.classList.add('js');
  var WA = '50258253416';

  // ── Textos en inglés (el español está escrito en el HTML y funciona sin scripts)
  var EN = {
    'meta.desc': 'MyWeek is the platform for driving schools: students, sales paid in installments, a lesson schedule per instructor, payments due and receipts over WhatsApp, on computers and phones.',
    'skip': 'Skip to content', 'logo.aria': 'MyWeek, home', 'nav.aria': 'Main', 'wa.aria': 'Message us on WhatsApp',
    'nav.features': 'Features', 'nav.gallery': 'Gallery', 'nav.demo': 'Demo', 'nav.editions': 'Editions', 'nav.faq': 'FAQ',
    'cta.demo': 'Get a demo', 'cta.try': 'Try it now', 'cta.whatsapp': 'Get a quote on WhatsApp', 'cta.whatsapp2': 'Message us on WhatsApp',
    'hero.eyebrow': 'New · Platform for driving schools',
    'hero.title': 'Your driving school in order, week after week.',
    'hero.sub': 'MyWeek brings together what today lives between a notebook and WhatsApp: students, sales paid in installments, each instructor’s schedule, payments due and receipts. You see who is coming today, who owes and how much came into the till, from a computer or a phone.',
    'hero.name': 'means “my week”: the week of your students, your instructors and your till, on a single screen.',
    'specs.title': 'Spec sheet',
    'specs.roles': 'profiles: Administration and Front desk, each with its own tools',
    'specs.views': 'schedule views: month, week, day and list',
    'specs.24h': 'notice to reschedule without the lesson being counted',
    'specs.cuotas': 'installments at most per sale, each with its own date and amount',
    'specs.pay': 'payment methods: cash, card, bank transfer and deposit',
    'specs.receipt': 'ways to hand over the receipt: shared on WhatsApp, by email or printed',
    'specs.kpi': 'progress indicators: collected, lessons given, new students, pending collection, active students and hours per instructor',
    'specs.due': 'days’ notice before an installment falls due (you can change it)',
    'feat.kicker': 'Standard equipment', 'feat.title': 'Everything your driving school keeps by hand today.',
    'f1.tag': 'Lesson schedule', 'f1.title': 'Every instructor’s week, at a glance.',
    'f1.text': 'See lessons by month, week, day or as a list, with one color per instructor. When booking, MyWeek shows the student’s plan and how many lessons are left, and it will not give the same time slot twice to the same instructor or the same student.',
    'f1.b1': 'Month, week, day and list', 'f1.b2': 'One color and one filter per instructor', 'f1.b3': 'Time clash warning before saving',
    'f2.tag': 'Rescheduling', 'f2.title': 'Reschedule without arguing over who loses the lesson.',
    'f2.text': 'If the student gives 24 hours’ notice or more, the lesson moves and is not counted. With less notice, MyWeek asks for a decision: reschedule without counting it, or cancel and count it. Every change goes into the lesson’s history, with who made it and when.',
    'f2.b1': 'The 24-hour rule, the same for everyone', 'f2.b2': 'The front desk decides when notice is short', 'f2.b3': 'History of every lesson',
    'f3.tag': 'Students', 'f3.title': 'Every student, with their progress in view.',
    'f3.text': 'The student’s page shows their plan, how many lessons they have taken and how many are left, the hours used, their installments and their balance. From there you book a lesson, record a payment or message them on WhatsApp.',
    'f3.b1': 'Lessons given, booked and still to book', 'f3.b2': 'Hours used and hours left', 'f3.b3': 'Balance and installments of every sale',
    'f4.tag': 'Sales & installments', 'f4.title': 'Installments that always add up to the price.',
    'f4.text': 'Sell a plan paid in full or in installments. MyWeek splits the price into equal parts and you change the date or amount of each one; the sale is not saved until the total matches the price.',
    'f4.b1': 'From 1 to 24 installments per sale', 'f4.b2': 'Dates and amounts to suit you', 'f4.b3': 'The sale in the name of the student or whoever pays',
    'f5.tag': 'Payments & receipts', 'f5.title': 'Know who owes, and hand over the receipt on the spot.',
    'f5.text': 'Payments due separates what is overdue from what is about to fall due, with the days left. Record the payment in cash, by card, bank transfer or deposit and the receipt comes out numbered, ready to share on WhatsApp, send by email or print.',
    'f5.b1': 'Overdue and upcoming installments, student by student', 'f5.b2': 'A numbered receipt for every payment', 'f5.b3': 'Shared, by email or printed',
    'f6.tag': 'Today, till & progress', 'f6.title': 'How your school is doing, without doing the math.',
    'f6.text': 'When you sign in, Today shows the day’s lessons, the installments to collect and, for administration, the day’s till. Progress shows, by week or by month, the money collected, lessons given, new students and hours per instructor, and compares the money collected with the previous period.',
    'f6.b1': 'The day’s till by payment method', 'f6.b2': 'Money collected, compared with the previous week or month', 'f6.b3': 'Till and progress, for administration only',
    'alt.week': 'Weekly schedule with each instructor’s lessons', 'alt.weekPhone': 'The day’s lessons on a phone',
    'alt.24h': 'Less-than-24-hours notice when rescheduling a lesson', 'alt.classPhone': 'Lesson details with its history on a phone',
    'alt.student': 'Student page with progress and installments', 'alt.studentPhone': 'Student page on a phone',
    'alt.sale': 'New sale paid in installments', 'alt.salePhone': 'Installments of a sale on a phone',
    'alt.dues': 'Payments due, overdue and upcoming', 'alt.receiptPhone': 'Payment receipt ready to share on a phone',
    'alt.progress': 'Weekly progress: collected, lessons, new students and hours per instructor', 'alt.todayPhone': 'Today screen with the day’s till on a phone',
    'gal.kicker': 'Gallery', 'gal.title': 'Take a look inside.', 'gal.hint': 'Swipe the images or use the arrows below.',
    'gal.prev': 'Previous', 'gal.next': 'Next', 'gal.aria': 'MyWeek screenshots',
    'gal.c1': 'Today: lessons, installments to collect and the day’s till', 'gal.c2': 'A full month of lessons', 'gal.c3': 'Payments due, on a phone',
    'gal.c4': 'Booking a lesson with the plan in view', 'gal.c5': 'Receipt archive with search', 'gal.c6': 'The whole menu, one tap away',
    'gal.c7': 'Today’s alerts: lessons and installments', 'gal.c8': 'Recording a payment', 'gal.c9': 'What the front desk sees', 'gal.c10': 'The day, hour by hour',
    'demo.kicker': 'Road test', 'demo.title': 'Try it now. No sign-up.',
    'demo.sub': 'El Volante, a sample driving school, with its instructors, plans, students, installments and this week’s lessons. Switch between Administration and Front desk from the bar at the top: book, reschedule, sell in installments and record a payment. Nothing you do is saved.',
    'demo.iframe': 'MyWeek interactive demo', 'demo.open': 'Open the demo full screen',
    'guide.kicker': 'User manual', 'guide.title': 'How it works, profile by profile.',
    'guide.text': 'What each profile can do, how each form is filled in, which rules the schedule follows and what MyWeek calculates for you. With screenshots of every screen.',
    'guide.cta': 'Read the manual',
    'guide.l1': 'Administration', 'guide.l1t': 'Everything the front desk does, plus plans, instructors, users, the day’s till, the receipt archive, progress and the school settings.',
    'guide.l2': 'Front desk', 'guide.l2t': 'Students, sales in installments, schedule, payments and receipts, day to day. Decides what happens when a student reschedules with less than 24 hours’ notice.',
    'guide.l3': 'First sign-in', 'guide.l3t': 'Administration creates the account with an initial password and hands it over; the person can change it with the “¿Olvidaste tu contraseña?” link on the sign-in screen.',
    'ed.kicker': 'Editions', 'ed.title': 'Choose the edition that fits your school.', 'ed.best': 'Recommended',
    'ed.quote1': 'Quote Essential', 'ed.quote2': 'Quote Professional', 'ed.quote3': 'Quote Tailored',
    'ed.e1': 'Essential', 'ed.e1for': 'To leave the notebook behind from day one.',
    'ed.e1b1': 'Students, plans and sales in installments', 'ed.e1b2': 'Month/week/day schedule', 'ed.e1b3': 'Receipts by WhatsApp, email or Messenger', 'ed.e1b4': 'Administration and front desk accounts',
    'ed.e2': 'Professional', 'ed.e2for': 'For schools that want everything under control.',
    'ed.e2b1': 'Everything in Essential', 'ed.e2b2': 'Alerts for upcoming lessons and overdue/upcoming installments', 'ed.e2b3': '24-hour rescheduling rule with a front desk decision',
    'ed.e2b4': 'Weekly and monthly progress (money collected, lessons given, new students, hours per instructor)', 'ed.e2b5': 'Day’s till and receipt archive for administration only',
    'ed.e3': 'Tailored', 'ed.e3for': 'For schools with their own rules.',
    'ed.e3b1': 'Everything in Professional', 'ed.e3b2': 'Adjustments to your rules', 'ed.e3b3': 'Data migration', 'ed.e3b4': 'Training',
    'ed.note': 'No one-size-fits-all packages: the price depends on the scope, and you get it in writing before we start.',
    'ind.kicker': 'Built for driving schools', 'ind.title': 'From a notebook and scattered messages to a school that knows everything about each student.',
    'ind.text': 'A driving school in Guatemala City wrote lessons in a notebook, collected installments from memory and confirmed every time change over WhatsApp. Today the front desk books and collects in MyWeek, every student gets a receipt when paying, and the owner sees the till and the week’s progress from a phone.',
    'ind.c1': 'Driving schools', 'ind.c2': 'Driving academies', 'ind.c3': 'Schools with several instructors', 'ind.c4': 'Theory and practice courses', 'ind.c5': 'Private driving lessons',
    'ind.b': 'Before', 'ind.b1': 'Lessons in a notebook, clashing time slots, installments nobody remembered to collect and handwritten receipts.',
    'ind.a': 'With MyWeek', 'ind.a1': 'Each instructor’s schedule, installments to collect and receipts in one place, with the day’s till in view.',
    'st.kicker': 'How to start', 'st.title': 'Three steps, with someone by your side.',
    'st.s1': 'Message us', 'st.s1t': 'Tell us on WhatsApp how your school works today: how many instructors you have, which plans you sell and how you collect. The first conversation is free.',
    'st.s2': 'We set it up', 'st.s2t': 'We load your plans, instructors and opening hours. You get the scope, price and timeline in writing.',
    'st.s3': 'Your school uses it', 'st.s3t': 'We train administration and the front desk, and stay with you during the first weeks.',
    'faq.kicker': 'FAQ', 'faq.title': 'What everyone asks.',
    'q1': 'Do we need to install anything?', 'a1': 'No. MyWeek opens in the browser on a computer or a phone. Everyone signs in with their email and password.',
    'q2': 'Does it work on phones?', 'a2': 'Yes. From a phone you book, reschedule, sell in installments, record a payment and share the receipt on WhatsApp. The menu sits at the bottom, within thumb’s reach.',
    'q3': 'Can the front desk see how much money comes in?', 'a3': 'No. The front desk books, sells and collects, and only sees payments recorded in the current week. The day’s till, the receipt archive and progress are for administration only, as are changes to plans, instructors and users.',
    'q4': 'What if a student cancels at the last minute?', 'a4': 'With 24 hours’ notice or more, the lesson is rescheduled without being counted. With less, the front desk chooses between rescheduling without counting it or cancelling and counting it, and the decision goes into the lesson’s history.',
    'q5': 'Is my data safe?', 'a5': 'Only the people administration registers can sign in, each with their email and their own password. Only administration can void a sale or a payment, always with a reason, and every change to a lesson goes into its history.',
    'q6': 'Can we bring over the students and installments we already have?', 'a6': 'Yes. In the Tailored edition we move your current students, sales and installments into MyWeek and train your team.',
    'q7': 'How much does it cost?', 'a7': 'The price depends on the scope: message us, we talk through what you need and send you the proposal in writing, with no commitment.',
    'final.title': 'One week in order. And the next one too.', 'final.text': 'Tell us how your driving school works today and we will show you MyWeek with your own plans and instructors.',
    'ftr.by': 'A product of', 'ftr.rights': 'All rights reserved.'
  };
  var TITLE = { es: 'MyWeek · Su escuela de manejo en orden, semana a semana', en: 'MyWeek · Your driving school in order, week after week' };
  // Un mensaje distinto por botón e idioma
  var MSG = {
    es: {
      hdr: '¡Hola! Quiero que me muestren MyWeek para mi escuela de manejo.',
      hero: '¡Hola! Vi MyWeek y quiero una cotización para mi escuela de manejo.',
      esencial: '¡Hola! Me interesa la versión Esencial de MyWeek para mi escuela de manejo.',
      profesional: '¡Hola! Me interesa la versión Profesional de MyWeek para mi escuela de manejo.',
      medida: '¡Hola! Me interesa MyWeek a la medida de las reglas de mi escuela de manejo.',
      final: '¡Hola! Le cuento cómo trabaja hoy mi escuela de manejo para ver MyWeek con mis planes e instructores.',
      float: '¡Hola! Tengo una pregunta sobre MyWeek para mi escuela de manejo.'
    },
    en: {
      hdr: 'Hi! I would like a MyWeek demo for my driving school.',
      hero: 'Hi! I saw MyWeek and would like a quote for my driving school.',
      esencial: 'Hi! I am interested in the MyWeek Essential edition for my driving school.',
      profesional: 'Hi! I am interested in the MyWeek Professional edition for my driving school.',
      medida: 'Hi! I am interested in a MyWeek tailored to my driving school’s rules.',
      final: 'Hi! Let me tell you how my driving school works today, to see MyWeek with my own plans and instructors.',
      float: 'Hi! I have a question about MyWeek for my driving school.'
    }
  };

  // Guardar el español escrito en la página para volver a él sin recargar
  var ES = {};
  var todos = function (sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); };
  todos('[data-i18n]', function (el) { ES[el.dataset.i18n] = el.innerHTML; });
  var ATRIBUTOS = [['i18nAlt', 'alt'], ['i18nAria', 'aria-label'], ['i18nTitle', 'title'], ['i18nContent', 'content']];
  ATRIBUTOS.forEach(function (a) {
    todos('[data-' + a[0].replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ']', function (el) {
      var k = el.dataset[a[0]]; if (!(k in ES)) ES[k] = el.getAttribute(a[1]);
    });
  });

  function setLang(lang, guardar) {
    lang = lang === 'en' ? 'en' : 'es';
    var T = function (k) { return lang === 'en' && EN[k] != null ? EN[k] : ES[k]; };
    document.documentElement.lang = lang;
    document.title = TITLE[lang];
    todos('[data-i18n]', function (el) { var v = T(el.dataset.i18n); if (v != null) el.innerHTML = v; });
    ATRIBUTOS.forEach(function (a) {
      todos('[data-' + a[0].replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ']', function (el) { el.setAttribute(a[1], T(el.dataset[a[0]])); });
    });
    todos('.solo-en', function (el) { el.hidden = lang !== 'en'; });
    todos('[data-wa]', function (a) {
      var m = MSG[lang][a.dataset.wa];
      a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(m);
    });
    todos('[data-lang]', function (b) { b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    if (guardar) try { localStorage.setItem('myweek-lang', lang); } catch (e) { /* sin almacenamiento */ }
    var u = new URL(location.href);
    if (lang === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang');
    history.replaceState(null, '', u.toString());
    if (window.MYWEEK_galMark) window.MYWEEK_galMark();
  }

  var lang = new URLSearchParams(location.search).get('lang');
  if (!lang) try { lang = localStorage.getItem('myweek-lang'); } catch (e) { /* sin almacenamiento */ }
  if (!lang) lang = (navigator.language || 'es').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  setLang(lang, false);
  todos('[data-lang]', function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang, true); }); });

  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Aparición al bajar
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  todos('.reveal', function (el, i) { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });

  // ── Contadores: el valor final ya está escrito; con scripts sube desde 0 al aparecer
  var contar = function (el) {
    var fin = Number(el.dataset.n), t0 = 0, dur = 1100;
    var paso = function (t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(fin * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(paso); else el.textContent = String(fin);
    };
    el.textContent = '0';
    requestAnimationFrame(paso);
  };
  if (!quieto) {
    var ioN = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { ioN.unobserve(e.target); contar(e.target); } });
    }, { threshold: 0.6 });
    todos('[data-n]', function (el) { ioN.observe(el); });
  }

  // ── Cabecera con borde al bajar
  var hdr = document.querySelector('.hdr');
  addEventListener('scroll', function () { hdr.classList.toggle('scrolled', scrollY > 8); }, { passive: true });

  // ── Galería: la imagen del centro es la activa; flechas, puntos y contador la siguen
  var track = document.getElementById('galTrack');
  var figs = Array.prototype.slice.call(track.querySelectorAll('figure'));
  var dots = document.getElementById('galDots');
  var cur = 0;
  function go(i) {
    i = Math.max(0, Math.min(figs.length - 1, i));
    var f = figs[i];
    track.scrollTo({ left: f.offsetLeft - (track.clientWidth - f.offsetWidth) / 2, behavior: quieto ? 'auto' : 'smooth' });
  }
  figs.forEach(function (f, i) {
    var d = document.createElement('button'); d.type = 'button'; d.className = 'dot';
    d.addEventListener('click', function () { go(i); }); dots.appendChild(d);
    f.addEventListener('click', function () { if (i !== cur) go(i); });
  });
  document.getElementById('galTot').textContent = figs.length;
  function mark() {
    var mid = track.scrollLeft + track.clientWidth / 2, best = 0, dist = Infinity;
    figs.forEach(function (f, i) { var d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
    cur = best;
    var en = document.documentElement.lang === 'en';
    figs.forEach(function (f, i) { f.classList.toggle('on', i === cur); });
    Array.prototype.forEach.call(dots.children, function (d, i) {
      d.classList.toggle('on', i === cur);
      d.setAttribute('aria-current', i === cur ? 'true' : 'false');
      d.setAttribute('aria-label', (en ? 'Go to image ' : 'Ir a la imagen ') + (i + 1));
    });
    document.getElementById('galNum').textContent = cur + 1;
    document.querySelector('[data-gal="-1"]').disabled = cur === 0;
    document.querySelector('[data-gal="1"]').disabled = cur === figs.length - 1;
  }
  var raf = 0;
  track.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark); }, { passive: true });
  addEventListener('resize', mark);
  todos('[data-gal]', function (b) { b.addEventListener('click', function () { go(cur + Number(b.dataset.gal)); }); });
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
  window.MYWEEK_galMark = mark;
  mark();

  // ── La demo se carga solo cuando el visitante llega a su sección (la página abre rápido)
  var frame = document.getElementById('demoFrame');
  if (frame) {
    var ioD = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { frame.src = frame.dataset.src; ioD.disconnect(); } });
    }, { rootMargin: '300px 0px' });
    ioD.observe(frame);
  }

  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();
