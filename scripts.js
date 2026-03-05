document.addEventListener('DOMContentLoaded', () => {
  initNavigationToggle();
  initPortAIAssistant();
});

function initNavigationToggle() {
  document.querySelectorAll('.nav-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inner = btn.closest('.nav-inner');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      inner.classList.toggle('open');
    });
  });
}

function initPortAIAssistant() {
  if (document.querySelector('.pe-ai-launcher')) {
    return;
  }

  const state = {
    proxyEndpoint: localStorage.getItem('pe_ai_proxy_endpoint') || '',
    proxyToken: localStorage.getItem('pe_ai_proxy_token') || '',
    model: localStorage.getItem('pe_ai_model') || 'gpt-4o-mini',
    isOpen: false,
    isLoading: false,
    history: [],
    knowledgeBase: [],
    portDomainLibrary: [],
    pageKnowledge: null
  };

  state.pageKnowledge = collectPageKnowledge();

  const launcher = document.createElement('button');
  launcher.className = 'pe-ai-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open AI assistant');
  launcher.textContent = 'AI';

  const panel = document.createElement('section');
  panel.className = 'pe-ai-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = [
    '<div class="pe-ai-header">',
    '  <div>',
    '    <h3>Port Engineering AI</h3>',
    '    <p>Student assistant</p>',
    '  </div>',
    '  <button type="button" class="pe-ai-close" aria-label="Close assistant">x</button>',
    '</div>',
    '<div class="pe-ai-body">',
    '  <div class="pe-ai-messages" aria-live="polite"></div>',
    '  <div class="pe-ai-suggestions">',
    '    <button type="button" class="pe-ai-chip">Summarize this page</button>',
    '    <button type="button" class="pe-ai-chip">What should I study for lecture 1?</button>',
    '    <button type="button" class="pe-ai-chip">Any assignment deadlines?</button>',
    '  </div>',
    '  <details class="pe-ai-settings">',
    '    <summary>AI settings (optional)</summary>',
    '    <label>Proxy endpoint URL</label>',
    '    <input type="url" class="pe-ai-endpoint" placeholder="https://your-domain.com/api/chat" autocomplete="off">',
    '    <label>Proxy access token (optional)</label>',
    '    <input type="password" class="pe-ai-token" placeholder="Optional token" autocomplete="off">',
    '    <label>Model</label>',
    '    <input type="text" class="pe-ai-model" placeholder="gpt-4o-mini">',
    '    <button type="button" class="pe-ai-save">Save settings</button>',
    '    <p class="pe-ai-note">Without a proxy endpoint, assistant uses built-in course help only.</p>',
    '  </details>',
    '  <form class="pe-ai-form">',
    '    <input type="text" class="pe-ai-input" placeholder="Ask about lectures, assignments, or concepts..." maxlength="500" required>',
    '    <button type="submit" class="pe-ai-send">Send</button>',
    '  </form>',
    '</div>'
  ].join('');

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector('.pe-ai-close');
  const messagesEl = panel.querySelector('.pe-ai-messages');
  const form = panel.querySelector('.pe-ai-form');
  const inputEl = panel.querySelector('.pe-ai-input');
  const saveBtn = panel.querySelector('.pe-ai-save');
  const endpointEl = panel.querySelector('.pe-ai-endpoint');
  const tokenEl = panel.querySelector('.pe-ai-token');
  const modelEl = panel.querySelector('.pe-ai-model');
  const chipButtons = panel.querySelectorAll('.pe-ai-chip');

  endpointEl.value = state.proxyEndpoint;
  tokenEl.value = state.proxyToken;
  modelEl.value = state.model;

  addAssistantMessage(
    messagesEl,
    'Hi, I can help with port engineering topics, lecture summaries, assignment reminders, and study strategy. Ask me anything.'
  );

  launcher.addEventListener('click', () => {
    state.isOpen = !state.isOpen;
    panel.classList.toggle('open', state.isOpen);
    panel.setAttribute('aria-hidden', String(!state.isOpen));
    if (state.isOpen) {
      inputEl.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    state.isOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });

  chipButtons.forEach((chip) => {
    chip.addEventListener('click', () => {
      inputEl.value = chip.textContent || '';
      form.requestSubmit();
    });
  });

  saveBtn.addEventListener('click', () => {
    state.proxyEndpoint = endpointEl.value.trim();
    state.proxyToken = tokenEl.value.trim();
    state.model = (modelEl.value || 'gpt-4o-mini').trim();
    localStorage.setItem('pe_ai_proxy_endpoint', state.proxyEndpoint);
    localStorage.setItem('pe_ai_proxy_token', state.proxyToken);
    localStorage.setItem('pe_ai_model', state.model);
    addAssistantMessage(messagesEl, 'Settings saved. I will use live AI when a proxy endpoint is available.');
  });

  loadKnowledgeBase(state).then((count) => {
    if (count > 0) {
      addAssistantMessage(messagesEl, `Knowledge base loaded (${count} topics).`);
    }
  });

  loadPortDomainLibrary(state).then((count) => {
    if (count > 0) {
      addAssistantMessage(messagesEl, `Port domain library loaded (${count} entries).`);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = inputEl.value.trim();
    if (!text || state.isLoading) {
      return;
    }

    inputEl.value = '';
    addUserMessage(messagesEl, text);
    state.history.push({ role: 'user', content: text });
    setLoading(panel, true);
    state.isLoading = true;

    try {
      const reply = await getAssistantReply(text, state);
      state.history.push({ role: 'assistant', content: reply });
      addAssistantMessage(messagesEl, reply);
    } catch (error) {
      addAssistantMessage(
        messagesEl,
        'I could not reach the live AI service. I can still help with built-in course guidance. Please try again.'
      );
    } finally {
      setLoading(panel, false);
      state.isLoading = false;
    }
  });
}

function setLoading(panel, isLoading) {
  const sendButton = panel.querySelector('.pe-ai-send');
  sendButton.disabled = isLoading;
  sendButton.textContent = isLoading ? '...' : 'Send';
}

function addUserMessage(container, text) {
  const bubble = document.createElement('div');
  bubble.className = 'pe-ai-msg pe-ai-msg-user';
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function addAssistantMessage(container, text) {
  const bubble = document.createElement('div');
  bubble.className = 'pe-ai-msg pe-ai-msg-assistant';
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

async function getAssistantReply(userMessage, state) {
  const localReply = getOfflineReply(userMessage, state, false);
  const quickReply = localReply || getOfflineReply(userMessage, state, true);

  if (!state.proxyEndpoint) {
    if (localReply) {
      return localReply;
    }

    const externalReply = await getExternalKnowledgeReply(userMessage);
    if (externalReply) {
      return externalReply;
    }

    return quickReply;
  }

  const systemMessage = [
    'You are an assistant for students in a Port Engineering course website.',
    'Be concise, practical, and educational.',
    'If dates or details are uncertain, advise students to confirm on the Assignments page.',
    'Current page context:',
    getPageContext()
  ].join('\n');

  const response = await fetch(state.proxyEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: state.proxyToken ? `Bearer ${state.proxyToken}` : ''
    },
    body: JSON.stringify({
      model: state.model,
      systemMessage,
      message: userMessage,
      history: state.history.slice(-8),
      pageContext: getPageContext(),
      pageKnowledge: state.pageKnowledge,
      fallback: quickReply
    })
  });

  if (!response.ok) {
    const externalReply = await getExternalKnowledgeReply(userMessage);
    if (externalReply) {
      return externalReply;
    }
    return quickReply;
  }

  const data = await response.json();
  const answer = data && data.answer ? data.answer : '';
  const finalAnswer = (answer || quickReply).trim();

  if (!localReply && finalAnswer === quickReply) {
    const externalReply = await getExternalKnowledgeReply(userMessage);
    if (externalReply) {
      return externalReply;
    }
  }

  return finalAnswer;
}

function getPageContext() {
  const title = document.title || 'Port Engineering Course';
  const firstHeading = document.querySelector('h1, h2');
  const headingText = firstHeading ? firstHeading.textContent.trim() : '';
  const pageType = detectPageType();
  return `Title: ${title}; Heading: ${headingText}; PageType: ${pageType}; URL: ${location.pathname}`;
}

function getOfflineReply(rawMessage, state, allowGenericFallback = true) {
  const message = rawMessage.toLowerCase();

  const domainReply = getDomainLibraryReply(message, state.portDomainLibrary);
  if (domainReply) {
    return withBookReference(domainReply, true);
  }

  const glossaryReply = getGlossaryReply(message);
  if (glossaryReply) {
    return withBookReference(glossaryReply, true);
  }

  const conceptReply = getCoreConceptReply(message);
  if (conceptReply) {
    return withBookReference(conceptReply, true);
  }

  if (/book|textbook|handbook|reference book|port and harbor engineering/.test(message)) {
    return `Recommended textbook: ${BOOK_TITLE}. Open: ${BOOK_URL}`;
  }

  const contextAware = getContextAwareFallback(rawMessage, state.pageKnowledge);
  if (contextAware) {
    return contextAware;
  }

  const knowledgeHit = findBestKnowledgeAnswer(rawMessage, state.knowledgeBase);
  if (knowledgeHit) {
    return knowledgeHit;
  }

  if (/deadline|due|assignment|submit/.test(message)) {
    return 'For deadlines and submission rules, check the Assignments page. Assignment 1 deadline is listed there, and Assignment 2 is marked coming soon.';
  }

  if (/attendance|present|absen/.test(message)) {
    return 'Use the Attendance page to submit your presence and review the attendance summary sheet.';
  }

  if (/resource|reading|journal|slide|video/.test(message)) {
    return 'Go to the Resources page for lecture slides, reading PDFs, and external references such as PIANC and UNCTAD.';
  }

  if (/lecture 1|introduction|topic/.test(message)) {
    return 'Lecture 1 focuses on why ports matter, terminal types, engineering constraints, and Indonesian port context. Start by comparing dry bulk, container, and liquid bulk handling logic.';
  }

  if (/breakwater|quay|fender|mooring|dredging|sediment/.test(message)) {
    return withBookReference(
      'These are core design elements in port engineering. Study environmental loading (wave/tide/current), structural response, and operational constraints together.',
      true
    );
  }

  if (/summarize|summary|this page/.test(message)) {
    return buildPageSummary();
  }

  if (!allowGenericFallback) {
    return '';
  }

  return 'I can help with lecture concepts, assignment guidance, attendance, and resources. Try asking: "Any assignment deadlines?", "Summarize lecture 1", or "Explain breakwater design basics".';
}

function buildPageSummary() {
  const knowledge = collectPageKnowledge();
  const headingText = knowledge.mainHeading || 'This page';
  const paragraphText = knowledge.intro || '';

  if (paragraphText) {
    return `${headingText}: ${paragraphText}`;
  }

  return `${headingText}: This page contains course information for Port Engineering students.`;
}

async function loadKnowledgeBase(state) {
  try {
    const response = await fetch('ai-knowledge.json', { cache: 'no-cache' });
    if (!response.ok) {
      return 0;
    }
    const data = await response.json();
    state.knowledgeBase = Array.isArray(data) ? data : [];
    return state.knowledgeBase.length;
  } catch (error) {
    return 0;
  }
}

async function loadPortDomainLibrary(state) {
  try {
    const response = await fetch('port-domain.json', { cache: 'no-cache' });
    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    state.portDomainLibrary = Array.isArray(data) ? data : [];
    return state.portDomainLibrary.length;
  } catch (error) {
    return 0;
  }
}

function findBestKnowledgeAnswer(question, knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.length) {
    return '';
  }

  const normalizedQuestion = normalizeText(question);
  let bestScore = 0;
  let bestAnswer = '';

  knowledgeBase.forEach((item) => {
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const score = keywords.reduce((sum, keyword) => sum + scoreKeywordMatch(normalizedQuestion, keyword), 0);

    if (score > bestScore && item.answer) {
      bestScore = score;
      bestAnswer = item.answer;
    }
  });

  return bestScore >= 2 ? bestAnswer : '';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectPageKnowledge() {
  const container = document.querySelector('.container') || document.body;
  const mainHeadingEl = container.querySelector('h1, h2');
  const paragraphEl = container.querySelector('p');
  const headings = Array.from(container.querySelectorAll('h1, h2, h3')).map((el) => cleanText(el.textContent)).filter(Boolean);
  const listItems = Array.from(container.querySelectorAll('li')).map((el) => cleanText(el.textContent)).filter(Boolean);
  const metadata = readAssistantMetadata();

  return {
    pageType: detectPageType(),
    title: cleanText(document.title),
    mainHeading: mainHeadingEl ? cleanText(mainHeadingEl.textContent) : '',
    intro: paragraphEl ? cleanText(paragraphEl.textContent) : '',
    headings: headings.slice(0, 12),
    keyPoints: listItems.slice(0, 18),
    metadata
  };
}

function getContextAwareFallback(rawMessage, pageKnowledge) {
  if (!pageKnowledge) {
    return '';
  }

  const message = normalizeText(rawMessage);
  const containsAny = (tokens) => tokens.some((token) => message.includes(token));

  const metadataAnswer = getMetadataAnswer(message, pageKnowledge.metadata);
  if (metadataAnswer) {
    return metadataAnswer;
  }

  if (containsAny(['summarize', 'summary', 'this page'])) {
    return buildPageSummaryFromKnowledge(pageKnowledge);
  }

  if (pageKnowledge.pageType === 'assignments' && containsAny(['deadline', 'due', 'submit', 'assignment'])) {
    const evidence = findEvidence(pageKnowledge, ['deadline', 'status', 'submit', 'late', 'assignment']);
    if (evidence.length) {
      return `From this page: ${evidence.join(' | ')}`;
    }
  }

  if (pageKnowledge.pageType === 'lectures' && containsAny(['lecture', 'topic', 'study', 'prepare'])) {
    const evidence = findEvidence(pageKnowledge, ['lecture', 'learning objective', 'key topic', 'terminal', 'engineering']);
    if (evidence.length) {
      return `Based on current lecture content: ${evidence.join(' | ')}`;
    }
  }

  if (pageKnowledge.pageType === 'resources' && containsAny(['resource', 'reading', 'slides', 'video'])) {
    const evidence = findEvidence(pageKnowledge, ['slides', 'reading', 'video', 'reference', 'resource']);
    if (evidence.length) {
      return `Available on this page: ${evidence.join(' | ')}`;
    }
  }

  return '';
}

function buildPageSummaryFromKnowledge(pageKnowledge) {
  if (!pageKnowledge) {
    return '';
  }

  const lead = pageKnowledge.intro || '';
  if (lead) {
    return `${pageKnowledge.mainHeading || 'This page'}: ${lead}`;
  }

  const highlights = findEvidence(pageKnowledge, ['assignment', 'lecture', 'resource', 'attendance', 'design', 'port']).slice(0, 2);
  if (highlights.length) {
    return `${pageKnowledge.mainHeading || 'This page'} highlights: ${highlights.join(' | ')}`;
  }

  return `${pageKnowledge.mainHeading || 'This page'}: This page contains course information for Port Engineering students.`;
}

function findEvidence(pageKnowledge, keywords) {
  const normalizedKeywords = keywords.map((keyword) => normalizeText(keyword));
  const source = [
    ...(pageKnowledge.headings || []),
    ...(pageKnowledge.keyPoints || []),
    ...getMetadataEvidenceLines(pageKnowledge.metadata)
  ];
  const hits = [];

  source.forEach((line) => {
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) {
      return;
    }

    if (normalizedKeywords.some((keyword) => keyword && normalizedLine.includes(keyword))) {
      hits.push(line);
    }
  });

  return dedupeArray(hits).slice(0, 3);
}

function dedupeArray(values) {
  return Array.from(new Set(values));
}

function detectPageType() {
  const path = (location.pathname || '').toLowerCase();
  if (path.includes('assignment')) {
    return 'assignments';
  }
  if (path.includes('lecture')) {
    return 'lectures';
  }
  if (path.includes('resource')) {
    return 'resources';
  }
  if (path.includes('attendance')) {
    return 'attendance';
  }
  return 'general';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readAssistantMetadata() {
  const metadataNode = document.querySelector('script.pe-ai-meta[type="application/json"]');
  if (!metadataNode) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataNode.textContent || '{}');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function getMetadataAnswer(message, metadata) {
  if (!metadata || !Array.isArray(metadata.quickAnswers)) {
    return '';
  }

  let bestScore = 0;
  let bestAnswer = '';
  metadata.quickAnswers.forEach((item) => {
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const answer = cleanText(item.answer);
    if (!answer) {
      return;
    }

    const score = keywords.reduce((sum, keyword) => sum + scoreKeywordMatch(message, keyword), 0);

    if (score > bestScore) {
      bestScore = score;
      bestAnswer = answer;
    }
  });

  return bestScore >= 2 ? bestAnswer : '';
}

function getMetadataEvidenceLines(metadata) {
  if (!metadata) {
    return [];
  }

  const lines = [];

  if (Array.isArray(metadata.facts)) {
    metadata.facts.forEach((fact) => {
      const text = cleanText(fact);
      if (text) {
        lines.push(text);
      }
    });
  }

  if (Array.isArray(metadata.deadlines)) {
    metadata.deadlines.forEach((item) => {
      const label = cleanText(item.label);
      const due = cleanText(item.due);
      const status = cleanText(item.status);
      const line = [label, due, status].filter(Boolean).join(' | ');
      if (line) {
        lines.push(line);
      }
    });
  }

  if (Array.isArray(metadata.links)) {
    metadata.links.forEach((item) => {
      const label = cleanText(item.label);
      const purpose = cleanText(item.purpose);
      const line = [label, purpose].filter(Boolean).join(' | ');
      if (line) {
        lines.push(line);
      }
    });
  }

  return lines.slice(0, 20);
}

function withBookReference(answer, include) {
  if (!include) {
    return answer;
  }

  if (!answer || answer.includes(BOOK_URL)) {
    return answer;
  }

  return `${answer}\n\nRecommended reading: ${BOOK_TITLE} (${BOOK_URL})`;
}

async function getExternalKnowledgeReply(question) {
  const cleaned = cleanText(question);
  const tokens = cleaned.split(' ').filter(Boolean);
  const hasUsefulToken = tokens.some((token) => token.length >= 3);
  if (!cleaned || !hasUsefulToken) {
    return '';
  }

  try {
    const queryCandidates = buildExternalQueryCandidates(cleaned);
    const seenTitles = new Set();

    for (const query of queryCandidates) {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&namespace=0&format=json&origin=*`;
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        continue;
      }

      const searchData = await searchResponse.json();
      const titles = Array.isArray(searchData) ? searchData[1] : null;
      if (!Array.isArray(titles) || !titles.length) {
        continue;
      }

      for (const titleRaw of titles) {
        const title = cleanText(titleRaw);
        if (!title || seenTitles.has(title.toLowerCase())) {
          continue;
        }
        seenTitles.add(title.toLowerCase());

        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const summaryResponse = await fetch(summaryUrl);
        if (!summaryResponse.ok) {
          continue;
        }

        const summaryData = await summaryResponse.json();
        const extract = cleanText(summaryData && summaryData.extract ? summaryData.extract : '');
        if (!extract) {
          continue;
        }

        const shortExtract = extract.length > 560 ? `${extract.slice(0, 557)}...` : extract;
        return `External reference (${title}): ${shortExtract}`;
      }
    }

    return '';
  } catch (error) {
    return '';
  }
}

function expandExternalQuery(query) {
  const trimmed = cleanText(query);
  if (!trimmed) {
    return query;
  }

  if (trimmed.split(' ').length === 1) {
    return `${trimmed} shipping port`;
  }

  return trimmed;
}

function buildExternalQueryCandidates(question) {
  const expanded = expandExternalQuery(question);
  return dedupeArray([
    expanded,
    `${expanded} port engineering`,
    `${expanded} maritime transport`,
    `${expanded} harbor engineering`
  ]).filter(Boolean);
}

function scoreKeywordMatch(normalizedQuestion, keyword) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return 0;
  }

  if (normalizedQuestion === normalizedKeyword) {
    return 4;
  }

  if (normalizedQuestion.includes(normalizedKeyword)) {
    return 3;
  }

  const keywordParts = normalizedKeyword.split(' ').filter((part) => part.length > 2);
  if (!keywordParts.length) {
    return 0;
  }

  let tokenHits = 0;
  keywordParts.forEach((part) => {
    if (normalizedQuestion.includes(part)) {
      tokenHits += 1;
    }
  });

  if (tokenHits >= Math.max(2, Math.ceil(keywordParts.length * 0.6))) {
    return 2;
  }

  return tokenHits >= 1 ? 1 : 0;
}

function getCoreConceptReply(message) {
  if (/\bbor\b|berth occupancy ratio/.test(message)) {
    return 'BOR (Berth Occupancy Ratio) is the percentage of time a berth is occupied during a period. It is commonly estimated as (total berth time used / total berth time available) x 100%. Higher BOR means higher utilization, but too high BOR can increase vessel waiting time and reduce service reliability.';
  }

  if (/types? of port|port types?|classification of ports?/.test(message)) {
    return 'Ports can be classified by function and cargo: container ports, dry bulk ports, liquid bulk terminals, general cargo ports, Ro-Ro ports, and multipurpose ports. They can also be classified by role: gateway ports, transshipment hubs, river/estuary ports, and coastal/deep-sea ports.';
  }

  if (/types? of terminal|terminal types?|container terminal|dry bulk|liquid bulk|ro-ro|general cargo/.test(message)) {
    return 'Main terminal types are: 1) Container terminal (TEU-based, STS-RTG/RMG flow), 2) Dry bulk terminal (tons, unloader-conveyor-stockyard), 3) Liquid bulk terminal (pipeline-tank systems), 4) General cargo terminal (break-bulk handling), and 5) Ro-Ro terminal (ramp-yard-gate vehicle flow).';
  }

  if (/river port|estuary port|riverine port|risks? at river ports?/.test(message)) {
    return 'Typical river/estuary port risks include high sedimentation and channel siltation, frequent dredging OPEX, variable currents and water levels, maneuvering constraints, and potential flooding impacts. Operationally, draft limitations and navigation reliability are major concerns.';
  }

  if (/sea port|coastal port|open sea port|risks? at sea ports?/.test(message)) {
    return 'Typical sea/coastal port risks include stronger wave exposure, storm surge, berth downtime during rough seas, breakwater damage risk, and coastal erosion/scour around structures. Design must focus on wave climate, protection layout, and resilient marine structures.';
  }

  if (/difference between river and sea port|compare river and sea port/.test(message)) {
    return 'River ports are usually more constrained by sedimentation and channel maintenance, while sea ports are more exposed to wave and storm loading. River ports often prioritize dredging strategy; sea ports prioritize wave protection and structural resilience.';
  }

  return '';
}

function getGlossaryReply(message) {
  const glossary = [
    {
      terms: ['teu', 'twenty-foot equivalent unit', 'container unit'],
      answer: 'TEU (Twenty-foot Equivalent Unit) is the standard unit for container capacity. One 20-foot container equals 1 TEU, while one 40-foot container is typically counted as 2 TEU.'
    },
    {
      terms: ['dwt', 'deadweight tonnage'],
      answer: 'DWT (Deadweight Tonnage) is the maximum weight a ship can safely carry, including cargo, fuel, freshwater, crew, and supplies.'
    },
    {
      terms: ['loa', 'length overall'],
      answer: 'LOA (Length Overall) is the maximum length of a vessel from the foremost to the aftmost fixed point, used in berth planning and maneuvering analysis.'
    },
    {
      terms: ['draft', 'draught', 'ship draft'],
      answer: 'Draft (draught) is the vertical distance between waterline and keel. It determines minimum channel and berth depth requirements.'
    },
    {
      terms: ['ukc', 'under keel clearance'],
      answer: 'UKC (Under Keel Clearance) is the safety distance between the ship keel and seabed. It accounts for tide, squat, wave motion, and uncertainty margins.'
    },
    {
      terms: ['sts crane', 'ship to shore crane'],
      answer: 'STS (Ship-to-Shore) cranes are quay cranes used to load and unload containers between vessels and terminal transport equipment.'
    },
    {
      terms: ['rtg', 'rubber tyred gantry'],
      answer: 'RTG (Rubber-Tyred Gantry) cranes are used in container yards to stack and retrieve containers with flexible mobility.'
    },
    {
      terms: ['rmg', 'rail mounted gantry'],
      answer: 'RMG (Rail-Mounted Gantry) cranes operate on fixed rails in container yards, providing high-density stacking and automated yard options.'
    },
    {
      terms: ['breakwater overtopping', 'overtopping'],
      answer: 'Breakwater overtopping occurs when wave run-up exceeds crest elevation and water passes over the structure, affecting safety and operations behind the breakwater.'
    }
  ];

  const normalized = normalizeText(message);
  for (const item of glossary) {
    const matched = item.terms.some((term) => scoreKeywordMatch(normalized, term) >= 2);
    if (matched) {
      return item.answer;
    }
  }

  return '';
}

function getDomainLibraryReply(message, externalLibrary) {
  const normalizedQuestion = normalizeText(message);
  if (!normalizedQuestion) {
    return '';
  }

  const library = Array.isArray(externalLibrary) && externalLibrary.length
    ? externalLibrary
    : PORT_DOMAIN_LIBRARY;

  let bestScore = 0;
  let bestAnswer = '';

  library.forEach((entry) => {
    const terms = Array.isArray(entry.terms) ? entry.terms : [];
    const score = terms.reduce((sum, term) => sum + scoreKeywordMatch(normalizedQuestion, term), 0);
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = entry.answer;
    }
  });

  return bestScore >= 3 ? bestAnswer : '';
}

const PORT_DOMAIN_LIBRARY = [
  {
    terms: ['berth occupancy ratio', 'bor', 'berth utilization'],
    answer: 'BOR (Berth Occupancy Ratio) is the fraction of time a berth is occupied in a period: BOR = berth time used / berth time available. It is usually shown in percent. High BOR improves asset use, but excessive BOR can increase waiting time and reduce schedule reliability.'
  },
  {
    terms: ['teu', 'twenty foot equivalent unit', 'container throughput'],
    answer: 'TEU (Twenty-foot Equivalent Unit) is the standard container capacity unit. 1 x 20-foot container = 1 TEU, and a 40-foot container is typically counted as 2 TEU. Ports use TEU for throughput, terminal capacity, and benchmarking.'
  },
  {
    terms: ['types of ports', 'port classification', 'gateway port', 'transshipment hub'],
    answer: 'Common port categories include container, dry bulk, liquid bulk, general cargo, Ro-Ro, and multipurpose ports. By logistics role, ports are often gateway ports (serving hinterland demand) or transshipment hubs (relay nodes between shipping routes).'
  },
  {
    terms: ['types of terminal', 'terminal classification', 'container terminal', 'bulk terminal'],
    answer: 'Main terminal types are: container terminal (TEU, STS-yard flow), dry bulk terminal (tons, unloading-conveyor-stockyard chain), liquid bulk terminal (pipeline-tank system), general cargo terminal (break-bulk handling), and Ro-Ro terminal (ramp-based vehicle flow).'
  },
  {
    terms: ['river port risk', 'estuary port risk', 'channel siltation', 'sedimentation'],
    answer: 'River/estuary ports are strongly exposed to sedimentation and channel siltation, requiring recurring maintenance dredging. Other common risks are variable currents, changing water levels, navigation constraints, and flood-related disruption.'
  },
  {
    terms: ['sea port risk', 'coastal port risk', 'storm surge', 'wave exposure'],
    answer: 'Sea/coastal ports face stronger wave and storm exposure. Key risks include berth downtime in rough weather, overtopping, breakwater damage, scour near marine structures, and coastal erosion impacts.'
  },
  {
    terms: ['difference river and sea port', 'compare river port and sea port', 'river vs sea port'],
    answer: 'River ports are usually constrained by sedimentation and dredging reliability, while sea ports are constrained by wave climate and storm loading. River-port strategy emphasizes channel maintenance; sea-port strategy emphasizes wave protection and structural resilience.'
  },
  {
    terms: ['quay wall design', 'wharf design', 'berthing structure'],
    answer: 'Quay/wharf design must combine geotechnical capacity, structural loads, berthing/mooring forces, and serviceability limits. Typical checks include global stability, settlement, deformation, and durability in marine exposure.'
  },
  {
    terms: ['fender design', 'berthing energy', 'ship impact'],
    answer: 'Fender systems absorb berthing energy and limit reaction force transferred to vessel and structure. Design normally evaluates vessel size, berthing velocity, approach angle, environmental conditions, and fender performance curves.'
  },
  {
    terms: ['mooring system', 'mooring line', 'mooring force'],
    answer: 'Mooring systems keep vessels safely positioned at berth under wind, wave, and current loads. Engineering checks include line tension limits, bollard capacity, ship motions, and operational envelope during loading/unloading.'
  },
  {
    terms: ['breakwater design', 'rubble mound breakwater', 'caisson breakwater'],
    answer: 'Breakwater design targets basin tranquility and structural stability under design storms. Key items include wave climate, water level extremes, armor stability, toe/scour protection, overtopping performance, and long-term maintenance.'
  },
  {
    terms: ['dredging', 'maintenance dredging', 'capital dredging'],
    answer: 'Capital dredging creates required depths for new channels/basins, while maintenance dredging restores depth lost by sedimentation. For many estuary ports, maintenance dredging is a recurring OPEX driver and must be planned strategically.'
  },
  {
    terms: ['under keel clearance', 'ukc', 'squat allowance'],
    answer: 'Under Keel Clearance (UKC) is the safety distance between keel and seabed. Channel depth planning typically includes static draft plus squat, tide/wave allowances, and operational safety margins.'
  },
  {
    terms: ['vessel turnaround time', 'turnaround', 'ship waiting time'],
    answer: 'Vessel turnaround time measures total time in port from arrival to departure. It combines waiting, berthing, and cargo operation time, and is a primary indicator of terminal service quality.'
  },
  {
    terms: ['yard occupancy ratio', 'yor', 'yard utilization'],
    answer: 'Yard Occupancy Ratio (YOR) indicates how full the storage yard is relative to capacity. High YOR can reduce stacking efficiency and increase re-handling, so it should be managed with gate, berth, and yard flow coordination.'
  },
  {
    terms: ['port master plan', 'phased development', 'port planning'],
    answer: 'A port master plan aligns long-term demand forecast, functional zoning, marine access, hinterland connectivity, environmental constraints, and phased investment strategy into a coherent development roadmap.'
  },
  {
    terms: ['hinterland connectivity', 'port logistics', 'intermodal'],
    answer: 'Hinterland connectivity links the port to road, rail, river, or inland depots. Strong intermodal links reduce dwell time and gate congestion, improving end-to-end supply-chain performance.'
  },
  {
    terms: ['container dwell time', 'dwell time'],
    answer: 'Container dwell time is the average time a container stays in terminal storage before exit or transshipment. Long dwell time increases yard pressure and can lower productivity.'
  },
  {
    terms: ['transshipment', 'feeder', 'hub and spoke'],
    answer: 'Transshipment is cargo transfer between vessels at an intermediate hub. In a hub-and-spoke system, large mainline vessels connect to regional feeder services to distribute cargo.'
  },
  {
    terms: ['port state control', 'psc'],
    answer: 'Port State Control (PSC) is the inspection regime by port authorities to verify foreign vessels comply with international safety, environmental, and labor conventions.'
  }
];

const BOOK_TITLE = 'Handbook of Port and Harbor Engineering (Tsinker, 1997)';
const BOOK_URL = 'https://link.springer.com/book/10.1007/978-1-4613-1291-8';