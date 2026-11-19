#!/usr/bin/env node
'use strict';

// Sin dependencias ni red: DOM mínimo y carga del script real en un VM aislado.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/consent.js'), 'utf8');
const KEY = 'vjl-consent-v1';
let passed = 0;

function test(name, run) {
  try { run(); passed++; console.log('ok - ' + name); }
  catch (error) { console.error('not ok - ' + name); throw error; }
}

function boot(options = {}) {
  const stored = options.storage || new Map();
  if (options.choice !== undefined) stored.set(KEY, options.choice);
  const timers = [];
  const writes = [];
  const calls = [];
  const doc = { listeners: {}, activeElement: null };

  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.nodeType = 1;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.parentElement = null;
      this.textContent = '';
      this.className = '';
      this.classList = {
        contains: value => this.className.split(/\s+/).includes(value),
        add: value => { if (!this.classList.contains(value)) this.className += ' ' + value; },
        remove: value => { this.className = this.className.split(/\s+/).filter(x => x !== value).join(' '); }
      };
    }
    get isConnected() { return this === doc.body || this === doc.head || !!(this.parentElement && this.parentElement.isConnected); }
    setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'class') this.className = value; }
    getAttribute(key) { return key === 'class' ? this.className : (this.attributes[key] ?? null); }
    hasAttribute(key) { return key in this.attributes; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      this.parentElement = null;
    }
    focus() { doc.activeElement = this; }
    matches(selector) {
      if (selector[0] === '.') return this.classList.contains(selector.slice(1));
      if (selector === 'a[href]') return this.tagName === 'A' && this.hasAttribute('href');
      if (selector === 'a[data-hotmart]') return this.tagName === 'A' && this.hasAttribute('data-hotmart');
      return this.tagName.toLowerCase() === selector;
    }
    closest(selector) {
      const selectors = selector.split(',').map(s => s.trim());
      for (let node = this; node; node = node.parentElement) {
        if (selectors.some(s => node.matches(s))) return node;
      }
      return null;
    }
    querySelector(selector) {
      for (const child of this.children) {
        if (child.matches(selector)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    fire(type, extras = {}) {
      const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extras };
      for (const listener of this.listeners[type] || []) listener(event);
      return event;
    }
    set innerHTML(value) {
      this.html = value;
      this.children = [];
      // Solo se necesitan los controles y párrafos del banner, no un parser HTML.
      for (const match of value.matchAll(/<(button|p|a)\b([^>]*)>([^<]*)/g)) {
        const child = new Element(match[1]);
        for (const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(attr[1], attr[2]);
        child.textContent = match[3];
        this.appendChild(child);
      }
    }
  }

  doc.head = new Element('head');
  doc.body = new Element('body');
  doc.activeElement = doc.body;
  doc.createElement = tag => new Element(tag);
  doc.querySelector = selector => doc.body.querySelector(selector) || doc.head.querySelector(selector);
  doc.addEventListener = (type, callback) => { (doc.listeners[type] ||= []).push(callback); };
  doc.fire = (type, target, extras = {}) => {
    const event = { type, target, button: 0, defaultPrevented: false, ...extras };
    for (const listener of doc.listeners[type] || []) listener(event);
  };

  const window = {
    location: new URL(options.url || 'https://example.test/index.html?email=ana%40example.test&src=VISITOR_SECRET#private'),
    setTimeout: fn => { timers.push(fn); return timers.length; },
    localStorage: {
      getItem(key) { if (options.blockRead) throw Error('Storage blocked'); return stored.get(key) ?? null; },
      setItem(key, value) { if (options.blockWrite) throw Error('Storage blocked'); writes.push([key, value]); stored.set(key, value); },
      removeItem(key) { if (options.blockRemove) throw Error('Storage blocked'); stored.delete(key); }
    }
  };
  // Emula listeners existentes de index/vsl registrados antes del script defer.
  if (options.legacy) doc.addEventListener('click', event => {
    const link = event.target.closest('a[data-hotmart]');
    if (link && typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout');
      window.fbq('track', 'Lead');
    }
  });
  vm.runInNewContext(source, { window, document: doc, URL }, { filename: 'consent.js' });

  return {
    window, doc, stored, calls, writes,
    timers() { while (timers.length) timers.shift()(); },
    banner() { return doc.querySelector('.consent'); },
    choose(selector) { assert.ok(this.banner(), 'banner visible'); this.banner().querySelector(selector).fire('click'); },
    scripts() { return doc.head.children.filter(el => el.tagName === 'SCRIPT'); },
    sdk() {
      const pixel = window.fbq;
      pixel.callMethod = function (...args) { assert.equal(this, pixel); calls.push(args); };
      const pending = Array.from(pixel.queue);
      pixel.queue = []; // El SDK puede reemplazar la cola: el stub debe seguirla.
      pending.forEach(args => pixel.callMethod.apply(pixel, args));
    },
    link(href = 'https://go.hotmart.com/O107442122M?ap=e5ca&src=LANDVELAS1', attrs = {}) {
      const link = new Element('a');
      link.setAttribute('href', href);
      for (const [key, value] of Object.entries(attrs)) link.setAttribute(key, value);
      doc.body.appendChild(link);
      return link;
    }
  };
}

function events(calls) { return calls.filter(args => /^track/.test(args[0])); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('inicial: sin SDK, fbq, red ni cola preconsent; API no emite', () => {
  const app = boot({ legacy: true });
  assert.equal(app.window.fbq, undefined);
  assert.equal(app.window.vjlTrack('CourseOutboundClick', { email: 'private' }), false);
  app.doc.fire('click', app.link(undefined, { 'data-hotmart': '' }));
  assert.equal(app.scripts().length, 0);
  app.timers();
  assert.ok(app.banner());
  assert.equal(app.banner().getAttribute('role'), 'dialog');
  assert.equal(app.doc.activeElement, app.banner().querySelector('.reject'));
  assert.match(app.banner().html, /Meta/);
  assert.match(app.banner().html, /Un clic no confirma una compra/);
});

test('rechazo persistido: segunda visita sin banner ni Meta', () => {
  const first = boot(); first.timers(); first.choose('.reject');
  assert.equal(first.stored.get(KEY), 'essential');
  assert.equal(first.banner(), null);
  const second = boot({ storage: first.stored }); second.timers();
  assert.equal(second.banner(), null);
  assert.equal(second.window.fbq, undefined);
  assert.equal(second.scripts().length, 0);
  assert.equal(second.window.vjlTrack('Test'), false);
});

test('aceptar: bootstrap estándar, grant/config/init/PageView una sola vez', () => {
  const app = boot(); app.timers(); app.choose('.accept');
  const pixel = app.window.fbq;
  assert.equal(app.stored.get(KEY), 'all');
  assert.equal(app.window._fbq, pixel);
  assert.equal(pixel.push, pixel);
  assert.equal(pixel.version, '2.0');
  assert.equal(pixel.loaded, true);
  assert.deepEqual(Array.from(pixel.queue, args => Array.from(args).slice(0, 2)), [
    ['consent', 'grant'], ['set', 'autoConfig'], ['init', '1424136109626344'], ['track', 'PageView']
  ]);
  assert.equal(pixel.queue[1][2], false);
  assert.equal(app.scripts().length, 1);
  assert.equal(app.scripts()[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  app.window.vjlOpenConsent(); app.choose('.accept');
  assert.equal(app.scripts().length, 1);
  assert.equal(Array.from(pixel.queue).filter(args => args[0] === 'init').length, 1);
  assert.equal(Array.from(pixel.queue).filter(args => args[1] === 'PageView').length, 1);
});

test('aceptación persistida carga sin banner y deja reabrir', () => {
  const app = boot({ choice: 'all' }); app.timers();
  assert.equal(app.scripts().length, 1);
  assert.equal(app.banner(), null);
  app.window.vjlOpenConsent(); assert.ok(app.banner());
  assert.equal(app.stored.get(KEY), 'all');
  assert.equal(app.window.vjlTrack('StillAccepted'), true);
  app.choose('.dismiss');
  assert.equal(app.stored.get(KEY), 'all');
});

test('reabrir rechazo y Escape no cambian decisión ni roban foco al cerrar', () => {
  const app = boot({ choice: 'essential' });
  const opener = app.link('/privacidad.html'); opener.focus();
  app.window.vjlOpenConsent(); app.window.vjlOpenConsent();
  assert.equal(app.doc.body.children.filter(el => el.classList.contains('consent')).length, 1);
  assert.equal(app.stored.get(KEY), 'essential');
  assert.equal(app.window.vjlTrack('Test'), false);
  assert.equal(app.banner().fire('keydown', { key: 'Escape' }).defaultPrevented, true);
  assert.equal(app.banner(), null);
  assert.equal(app.doc.activeElement, opener);
  assert.equal(app.stored.get(KEY), 'essential');
});

test('stub despacha callMethod y usa la cola actual, no la capturada', () => {
  const app = boot({ choice: 'all' });
  const oldQueue = app.window.fbq.queue;
  app.window.fbq.queue = [];
  app.window.vjlTrack('QueuedAfterConsent');
  assert.equal(oldQueue.length, 4);
  assert.equal(app.window.fbq.queue.length, 1);
  assert.equal(app.window.fbq.queue[0][1], 'QueuedAfterConsent');
  app.sdk();
  app.window.vjlTrack('Dispatched', { placement: 'hero' });
  assert.equal(app.calls.at(-1)[0], 'trackCustom');
  assert.equal(app.calls.at(-1)[1], 'Dispatched');
  assert.equal(app.window.fbq.queue.length, 0);
});

test('revocar SDK cargado envía revoke y bloquea API y llamadas fbq legacy', () => {
  const app = boot({ choice: 'all', legacy: true }); app.sdk();
  app.window.vjlOpenConsent(); app.choose('.reject');
  assert.deepEqual(app.calls.at(-1), ['consent', 'revoke']);
  const count = app.calls.length;
  assert.equal(app.window.vjlTrack('NoConsent'), false);
  app.window.fbq('trackCustom', 'Bypass');
  app.window.fbq('track', 'PageView');
  app.doc.fire('click', app.link(undefined, { 'data-hotmart': '' }));
  assert.equal(app.calls.length, count);
  assert.equal(app.stored.get(KEY), 'essential');
});

test('revocar durante descarga purga eventos pendientes y grant antiguo', () => {
  const app = boot({ choice: 'all' });
  app.window.vjlTrack('BeforeRevocation');
  app.window.vjlOpenConsent(); app.choose('.reject');
  assert.equal(Array.from(app.window.fbq.queue).filter(args => /^track/.test(args[0])).length, 0);
  app.sdk();
  assert.equal(events(app.calls).length, 0);
  assert.equal(app.calls.some(args => args[0] === 'consent' && args[1] === 'grant'), false);
  assert.deepEqual(app.calls.at(-1), ['consent', 'revoke']);
});

test('reaceptar concede permiso sin reinicializar ni repetir eventos descartados', () => {
  const app = boot({ choice: 'all' }); app.sdk();
  app.window.vjlOpenConsent(); app.choose('.reject');
  app.window.vjlTrack('Discarded');
  app.window.vjlOpenConsent(); app.choose('.accept');
  assert.deepEqual(app.calls.at(-1), ['consent', 'grant']);
  assert.equal(app.window.vjlTrack('AfterReaccept'), true);
  assert.equal(app.calls.at(-1)[1], 'AfterReaccept');
  assert.equal(app.calls.filter(args => args[0] === 'init').length, 1);
  assert.equal(app.calls.filter(args => args[1] === 'PageView').length, 1);
  assert.equal(app.calls.some(args => args[1] === 'Discarded'), false);
  assert.equal(app.scripts().length, 1);
});

test('delegación de descendientes/dinámicos: solo clics honestos, sin legacy checkout/Lead', () => {
  const app = boot({ choice: 'all', legacy: true }); app.sdk();
  const link = app.link(undefined, { 'data-hotmart': '', class: 'cta--hero' });
  const child = app.doc.createElement('span'); link.appendChild(child);
  app.doc.fire('click', child);
  assert.equal(app.calls.at(-1)[0], 'trackCustom');
  assert.equal(app.calls.at(-1)[1], 'CourseOutboundClick');
  assert.deepEqual(plain(app.calls.at(-1)[2]), {
    pathname: '/index.html', placement: 'hero', src: 'LANDVELAS1', destination: 'go.hotmart.com'
  });
  const amazon = app.link('https://www.amazon.com/dp/PRIVATE?tag=validsumshop-20', { rel: 'sponsored noopener' });
  app.doc.fire('click', amazon);
  assert.equal(app.calls.at(-1)[1], 'AffiliateOutboundClick');
  assert.equal(app.calls.at(-1)[2].destination, 'www.amazon.com');
  assert.equal(events(app.calls).filter(args => /^(Purchase|InitiateCheckout|Lead)$/.test(args[1])).length, 0);
});

test('parámetros mínimos, sin PII/query/hash ni forwarding al enlace', () => {
  const app = boot({ choice: 'all' }); app.sdk();
  const link = app.link('https://go.hotmart.com/O107442122M?src=private%40example.test&email=private', { 'data-placement': 'private@example.test' });
  const href = link.getAttribute('href');
  app.doc.fire('click', link);
  assert.equal(link.getAttribute('href'), href);
  assert.deepEqual(plain(app.calls.at(-1)[2]), {
    pathname: '/index.html', placement: 'content', destination: 'go.hotmart.com'
  });
  app.window.vjlTrack('SafeEvent', {
    pathname: '/private@example.test', email: 'private@example.test', phone: '12345',
    destination: 'https://example.test/?email=private', src: 'A'.repeat(100), placement: 'B'.repeat(100)
  });
  assert.deepEqual(plain(app.calls.at(-1)[2]), { pathname: '/index.html' });
  app.window.vjlTrack('NoObjectLeak', {
    placement: { email: 'private@example.test', toString() { return 'hero'; } },
    src: ['LANDVELAS1'], destination: ['example.test']
  });
  assert.deepEqual(plain(app.calls.at(-1)[2]), { pathname: '/index.html' });
  assert.equal(JSON.stringify(app.calls).includes('VISITOR_SECRET'), false);
  assert.equal(JSON.stringify(app.calls).includes('private@example.test'), false);
});

test('ruta pública normalizada, segmentos personales desconocidos no se envían', () => {
  const app = boot({ choice: 'all', url: 'https://example.test/private/person@example.test?secret=1' }); app.sdk();
  app.window.vjlTrack('Safe');
  assert.deepEqual(plain(app.calls.at(-1)[2]), { pathname: '/' });
});

test('clic interno/no afiliado, protocolos peligrosos y cancelados no cuentan', () => {
  const app = boot({ choice: 'all' }); app.sdk();
  const count = app.calls.length;
  for (const href of ['/kit.html', 'https://go.hotmart.com.evil.test/x', 'javascript:alert(1)', 'mailto:a@example.test', 'https://example.org/']) {
    app.doc.fire('click', app.link(href));
  }
  app.doc.fire('click', app.link(), { defaultPrevented: true });
  app.doc.fire('auxclick', app.link(), { button: 2 });
  assert.equal(app.calls.length, count);
  app.doc.fire('auxclick', app.link(), { button: 1 });
  assert.equal(app.calls.at(-1)[1], 'CourseOutboundClick');
});

test('API rechaza conversiones y nombres inválidos; fbq directo no sortea API', () => {
  const app = boot({ choice: 'all' }); app.sdk();
  const count = app.calls.length;
  for (const name of ['Purchase', 'InitiateCheckout', 'purchase', 'Lead', '', 'bad@email', 'x'.repeat(65), null]) {
    assert.equal(app.window.vjlTrack(name), false);
  }
  app.window.fbq('track', 'Purchase');
  app.window.fbq('trackSingle', 'id', 'Purchase');
  app.window.fbq('trackCustom', 'Raw');
  assert.equal(app.calls.length, count);
});

test('storage bloqueado: elegir, reabrir y revocar siguen funcionando en memoria', () => {
  const app = boot({ blockRead: true, blockWrite: true, blockRemove: true }); app.timers();
  assert.match(app.banner().querySelector('.storage-note').textContent, /solo en esta página/);
  app.choose('.accept'); app.sdk();
  assert.equal(app.window.vjlTrack('Accepted'), true);
  app.window.vjlOpenConsent(); app.choose('.reject');
  assert.equal(app.window.vjlTrack('Rejected'), false);
  assert.deepEqual(app.calls.at(-1), ['consent', 'revoke']);
  assert.equal(app.stored.has(KEY), false);
});

test('fallo al guardar rechazo elimina aceptación antigua si es posible', () => {
  const app = boot({ choice: 'all', blockWrite: true }); app.sdk();
  app.window.vjlOpenConsent(); app.choose('.reject');
  assert.equal(app.stored.has(KEY), false);
  assert.equal(app.window.vjlTrack('Rejected'), false);
});

test('elección inválida requiere decisión y temporizador no reabre tras decidir', () => {
  const app = boot({ choice: 'unknown' });
  assert.equal(app.scripts().length, 0);
  app.window.vjlOpenConsent(); app.choose('.reject'); app.timers();
  assert.equal(app.banner(), null);
  assert.equal(app.stored.get(KEY), 'essential');
});

test('un fallo del SDK no impide retirar permiso ni cerrar el diálogo', () => {
  const app = boot({ choice: 'all' });
  app.window.fbq.callMethod = () => { throw Error('SDK failure'); };
  assert.equal(app.window.vjlTrack('Failure'), false);
  app.window.vjlOpenConsent(); app.choose('.reject');
  assert.equal(app.banner(), null);
  assert.equal(app.stored.get(KEY), 'essential');
  assert.equal(app.window.vjlTrack('NoConsent'), false);
});

console.log('\n' + passed + ' pruebas de consentimiento superadas.');
