/* Fluent Welding - shared navigation, drawing filters and RFQ UI.
   Existing Apps Script endpoint and item field names are preserved.
   No external libraries, trackers, API keys, or client-side credential storage. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  const nav = document.getElementById('main-nav');
  const mobileToggle = document.querySelector('.mobile-toggle');
  const desktop = window.matchMedia('(min-width: 1051px)');
  const mouse = window.matchMedia('(hover: hover) and (pointer: fine)');
  const groups = [...document.querySelectorAll('[data-nav-group]')];
  const timers = new WeakMap();

  function setMenu(group, open, mode = '') {
    const trigger = group.querySelector('.nav-trigger');
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    window.clearTimeout(timers.get(group));
    if (open) groups.forEach(other => { if (other !== group) setMenu(other, false); });
    trigger.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    group.dataset.mode = open ? mode : '';
  }
  function closeMenus() { groups.forEach(group => setMenu(group, false)); }
  groups.forEach(group => {
    const trigger = group.querySelector('.nav-trigger');
    trigger.addEventListener('click', () => {
      if (group.dataset.mode === 'hover') setMenu(group, true, 'pinned');
      else setMenu(group, trigger.getAttribute('aria-expanded') !== 'true', 'pinned');
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMenu(group, true, 'keyboard');
        group.querySelector('.nav-dropdown a').focus();
      }
    });
    group.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && desktop.matches && mouse.matches) {
        setMenu(group, true, group.dataset.mode || 'hover');
      }
    });
    group.addEventListener('pointerleave', () => {
      if (group.dataset.mode === 'hover') {
        timers.set(group, window.setTimeout(() => {
          if (!group.contains(document.activeElement)) setMenu(group, false);
        }, 180));
      }
    });
    group.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!group.contains(document.activeElement)) setMenu(group, false);
      }, 0);
    });
  });
  if (nav && mobileToggle) {
    mobileToggle.hidden = false;
    function mobileOpen(open) {
      mobileToggle.setAttribute('aria-expanded', String(open));
      nav.dataset.open = String(open);
      if (!open) closeMenus();
    }
    mobileToggle.addEventListener('click', () => mobileOpen(mobileToggle.getAttribute('aria-expanded') !== 'true'));
    desktop.addEventListener('change', () => mobileOpen(false));
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) mobileOpen(false);
    });
    document.addEventListener('click', event => {
      if (!nav.contains(event.target) && !mobileToggle.contains(event.target)) mobileOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const openGroup = groups.find(group => group.querySelector('.nav-trigger').getAttribute('aria-expanded') === 'true');
      if (openGroup) {
        const restore = openGroup.contains(document.activeElement);
        setMenu(openGroup, false);
        if (restore) openGroup.querySelector('.nav-trigger').focus();
        event.preventDefault();
      } else if (mobileToggle.getAttribute('aria-expanded') === 'true') {
        mobileOpen(false);
        mobileToggle.focus();
        event.preventDefault();
      }
    });
  }

  // Drawing content is present in the HTML and remains usable without JavaScript.
  const drawingSearch = document.getElementById('drawingSearch');
  if (drawingSearch) {
    const family = document.getElementById('drawingFamily');
    const size = document.getElementById('drawingSize');
    const drawings = [...document.querySelectorAll('[data-drawing]')];
    const count = document.getElementById('drawingCount');
    const empty = document.getElementById('noDrawings');
    const filter = () => {
      const search = drawingSearch.value.trim().toLowerCase();
      let matches = 0;
      drawings.forEach(card => {
        const show = (!family.value || family.value === card.dataset.family) &&
                     (!size.value || size.value === card.dataset.size) &&
                     (!search || card.dataset.search.toLowerCase().includes(search));
        card.hidden = !show;
        if (show) matches++;
      });
      count.textContent = `${matches} drawing sheet${matches === 1 ? '' : 's'}`;
      empty.hidden = matches !== 0;
    };
    drawingSearch.addEventListener('input', filter);
    family.addEventListener('change', filter);
    size.addEventListener('change', filter);
    document.getElementById('clearDrawings').addEventListener('click', () => {
      drawingSearch.value = ''; family.value = ''; size.value = ''; filter(); drawingSearch.focus();
    });
    filter();
  }


  // Referral intake uses the existing field names, not a new API or partner contact list.
  function initServiceRequest() {
    const referral = document.getElementById('serviceRequestForm');
    if (!referral) return;
    const type = document.getElementById('serviceType');
    const application = document.getElementById('serviceApplication');
    const aerial = document.getElementById('aerialRequestDetails');
    const submit = document.getElementById('serviceSubmit');
    const status = document.getElementById('serviceStatus');
    const again = document.getElementById('newServiceRequest');
    let busy = false;
    const aerialTypes = new Set(['Drone Inspection Imagery', 'Aerial Mapping / Site Survey', 'Aerial Photography / Video']);
    const supported = (field, value) => [...field.options].some(option => option.value === value);
    const clean = (id, limit = 500) => (document.getElementById(id).value || '').trim().slice(0, limit);
    const setStatus = (text, state = '') => { status.textContent = text; status.dataset.state = state; };
    const showAerial = () => { aerial.hidden = !aerialTypes.has(type.value); };
    const params = new URLSearchParams(location.search);
    if (supported(type, params.get('service'))) type.value = params.get('service');
    if (supported(application, params.get('application'))) application.value = params.get('application');
    showAerial();
    type.addEventListener('change', showAerial);
    document.querySelectorAll('[data-service-prefill]').forEach(link => {
      link.addEventListener('click', () => {
        if (!busy && supported(type, link.dataset.servicePrefill)) {
          type.value = link.dataset.servicePrefill;
          showAerial();
        }
      });
    });
    referral.hidden = false;
    again.addEventListener('click', () => {
      if (busy) return;
      referral.reset(); showAerial(); again.hidden = true; submit.disabled = false;
      submit.textContent = 'Request a Connection';
      setStatus('Enter a new connection request. Previously submitted requests are not changed.');
      referral.elements.name.focus();
    });
    referral.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !referral.reportValidity()) return;
      if (location.protocol === 'file:' || ['localhost','127.0.0.1','::1'].includes(location.hostname)) {
        setStatus('Local preview only: no request was sent. Use the published website to request a connection.', 'warning');
        return;
      }
      busy = true; referral.setAttribute('aria-busy','true'); submit.disabled = true; submit.textContent = 'Sending...';
      setStatus('Sending the connection request to Fluent for processing...');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25000);
      try {
        // Keep the backend schema exactly compatible with the existing RFQ endpoint.
        // A quantity of one represents one inquiry, not an order for a fabricated item.
        const payload = new URLSearchParams();
        for (const key of ['name','company','email','phone','shipto','requested_date']) {
          payload.set(key, referral.elements.namedItem(key).value.trim());
        }
        const project = referral.elements.project.value.trim();
        payload.set('project', 'SERVICE CONNECTION - ' + (project || type.value));
        payload.set('item_count', '1');
        payload.set('item_type_0', 'Other');
        payload.set('item_size_0', 'Service referral only - no fabricated component requested');
        payload.set('item_material_0', 'Not Sure');
        payload.set('item_qty_0', '1');
        payload.set('item_notes_0', 'SERVICE CONNECTION REQUEST - NOT AN ORDER\nService requested: ' + type.value);
        const details = [
          'SERVICE CONNECTION REQUEST - NOT AN ORDER OR BOOKING',
          'Service requested: ' + type.value,
          'Tank / project application: ' + (application.value || 'Not specified'),
          'Timing: ' + (clean('serviceTiming') || 'Discuss during follow-up'),
          'Tank size / capacity: ' + (clean('tankCapacity') || 'Not specified'),
          'Tank construction / liquid: ' + (clean('tankDetails') || 'Not specified'),
        ];
        if (aerialTypes.has(type.value)) {
          details.push('Aerial coverage / assets: ' + (clean('aerialCoverage') || 'Not specified'));
          details.push('Aerial deliverables / use: ' + (clean('aerialDeliverables') || 'Not specified'));
          details.push('Accuracy / survey requirements: ' + (clean('aerialAccuracy') || 'Discuss with provider'));
        }
        details.push('Request details:\n' + referral.elements.project_details.value.trim());
        details.push('Acknowledgment: connection request only, not a service booking or order.');
        details.push('Privacy: obtain customer permission before sharing contact or project details with an independent provider. This form does not grant forwarding permission.');
        payload.set('project_details', details.join('\n\n'));
        await fetch(referral.action, {
          method:'POST', mode:'no-cors', credentials:'omit',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body:payload, signal:controller.signal
        });
        // The opaque response cannot verify processing or email delivery. Retain entered data.
        setStatus('Request sent for processing. Check your email for the Fluent request confirmation; the existing system may label it an RFQ. This is not a booking. If no confirmation arrives, call 740-606-8333 before submitting again. Your details remain here.', 'sent');
        submit.textContent = 'Check Email for Confirmation';
        again.hidden = false;
      } catch (error) {
        setStatus('We could not confirm transmission. Your details are still here. Check for a confirmation email before trying again, or call 740-606-8333.', 'warning');
        submit.disabled = false; submit.textContent = 'Request a Connection';
      } finally {
        window.clearTimeout(timeout); busy = false; referral.setAttribute('aria-busy','false');
      }
    });
  }
  initServiceRequest();

  const form = document.getElementById('quoteForm');
  if (!form) return;
  const itemList = document.getElementById('itemList');
  const addButton = document.getElementById('addItem');
  const submit = document.getElementById('quoteSubmit');
  const status = document.getElementById('formStatus');
  const newRequest = document.getElementById('newRequest');
  const application = document.getElementById('applicationContext');
  const supply = document.getElementById('supplyContext');
  const itemTemplate = itemList.firstElementChild.cloneNode(true);
  let busy = false;

  function renumberItems() {
    [...itemList.children].forEach((item, index) => {
      item.dataset.itemIndex = String(index);
      item.querySelector('h3').textContent = `Item ${index + 1}`;
      item.querySelectorAll('[name]').forEach(field => {
        field.name = field.name.replace(/_\d+$/, `_${index}`);
      });
      const remove = item.querySelector('.remove-item');
      if (remove) remove.setAttribute('aria-label', `Remove item ${index + 1}`);
    });
  }
  function addItem(focus = true) {
    const item = itemTemplate.cloneNode(true);
    item.querySelectorAll('input,select,textarea').forEach(field => { field.value = ''; });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'remove-item'; remove.textContent = 'Remove';
    item.querySelector('.item-header').appendChild(remove);
    itemList.appendChild(item); renumberItems();
    if (focus) item.querySelector('select').focus();
  }
  addButton.hidden = false;
  addButton.addEventListener('click', () => { if (!busy) addItem(); });
  itemList.addEventListener('click', event => {
    const remove = event.target.closest('.remove-item');
    if (!remove || busy) return;
    const item = remove.closest('.quote-item');
    const previous = item.previousElementSibling;
    item.remove(); renumberItems();
    if (previous) previous.querySelector('select').focus();
  });

  // Prefill only supported option values. User-supplied text is assigned as text/value, never HTML.
  const params = new URLSearchParams(location.search);
  function selectSupported(field, value) {
    if ([...field.options].some(option => option.value === value)) field.value = value;
  }
  selectSupported(form.elements.item_type_0, params.get('product') || '');
  selectSupported(application, params.get('application') || '');
  if (params.has('size')) form.elements.item_size_0.value = params.get('size').slice(0,200);
  const part = (params.get('part') || '').slice(0,160);
  const notes = (params.get('notes') || '').slice(0,1500);
  form.elements.item_notes_0.value = [part ? `Fluent part number: ${part}` : '', notes].filter(Boolean).join('\n');
  if (part.endsWith('-304')) selectSupported(form.elements.item_material_0, '304 Stainless');

  function setStatus(text, state) { status.textContent = text; status.dataset.state = state; }
  newRequest.addEventListener('click', () => {
    form.reset();
    itemList.replaceChildren(itemTemplate.cloneNode(true));
    newRequest.hidden = true; submit.disabled = false; submit.textContent = 'Submit Quote Request';
    setStatus('Enter a new request. Previously submitted requests are not changed.', '');
    form.elements.name.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    // Local review must never send accidental quote requests.
    if (location.protocol === 'file:' || ['localhost','127.0.0.1','::1'].includes(location.hostname)) {
      setStatus('Local preview only: no request was sent. Use the published website to submit a quote request.', 'warning');
      return;
    }
    busy = true; form.setAttribute('aria-busy','true'); submit.disabled = true; submit.textContent = 'Sending...';
    setStatus('Sending the request for processing...', '');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const formData = new FormData(form);
      formData.set('item_count', String(itemList.children.length));
      const context = [];
      if (application.value) context.push(`Tank application: ${application.value}`);
      if (supply.value) context.push(`Supply route: ${supply.value}`);
      const existingDetails = String(formData.get('project_details') || '').trim();
      if (existingDetails) context.push(existingDetails);
      formData.set('project_details', context.join('\n\n'));
      await fetch(form.action, {
        method:'POST', mode:'no-cors', credentials:'omit',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:new URLSearchParams(formData), signal:controller.signal
      });
      // An opaque no-cors response cannot confirm server processing or email delivery.
      // Keep the entered details rather than clearing an unconfirmed RFQ.
      setStatus('Request sent for processing. Please check your email for the RFQ confirmation, which confirms receipt. If no confirmation arrives, call 740-606-8333 before submitting again. Your entered details remain here.', 'sent');
      submit.textContent = 'Check Email for Confirmation';
      newRequest.hidden = false;
    } catch (error) {
      setStatus('We could not confirm transmission. Your details have been kept. Check for an RFQ confirmation email before trying again, or call 740-606-8333.', 'warning');
      submit.disabled = false; submit.textContent = 'Submit Quote Request';
    } finally {
      window.clearTimeout(timeout); busy = false; form.setAttribute('aria-busy','false');
    }
  });
})();
