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
  const quickReply = getOfflineReply(userMessage, state);
  if (!state.proxyEndpoint) {
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
    return quickReply;
  }

  const data = await response.json();
  const answer = data && data.answer ? data.answer : '';
  return (answer || quickReply).trim();
}

function getPageContext() {
  const title = document.title || 'Port Engineering Course';
  const firstHeading = document.querySelector('h1, h2');
  const headingText = firstHeading ? firstHeading.textContent.trim() : '';
  const pageType = detectPageType();
  return `Title: ${title}; Heading: ${headingText}; PageType: ${pageType}; URL: ${location.pathname}`;
}

function getOfflineReply(rawMessage, state) {
  const message = rawMessage.toLowerCase();

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
    return 'These are core design elements in port engineering. Study environmental loading (wave/tide/current), structural response, and operational constraints together.';
  }

  if (/summarize|summary|this page/.test(message)) {
    return buildPageSummary();
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

function findBestKnowledgeAnswer(question, knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.length) {
    return '';
  }

  const normalizedQuestion = normalizeText(question);
  let bestScore = 0;
  let bestAnswer = '';

  knowledgeBase.forEach((item) => {
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    let score = 0;

    keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword && normalizedQuestion.includes(normalizedKeyword)) {
        score += 1;
      }
    });

    if (score > bestScore && item.answer) {
      bestScore = score;
      bestAnswer = item.answer;
    }
  });

  return bestScore > 0 ? bestAnswer : '';
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

    let score = 0;
    keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword && message.includes(normalizedKeyword)) {
        score += 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestAnswer = answer;
    }
  });

  return bestScore > 0 ? bestAnswer : '';
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