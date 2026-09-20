#!/usr/bin/env node
/**
 * 8x assignment capture hook.
 *
 * Wired to UserPromptSubmit and Stop in .claude/settings.json. Appends the
 * verbatim prompt and the final assistant response for each turn to
 * .agent-logs/<YYYY-MM-DD_HH-MM-SS>_<session-id-8>.md
 *
 * Deliberately records nothing in between: no thinking, no tool calls, no
 * intermediate steps.
 *
 * This hook must never break the session. Every failure path exits 0 and
 * leaves a note in .agent-logs/.capture-errors.log.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = 'claude-code';

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function nowIso() {
  return new Date().toISOString();
}

/** UTC filename stamp: YYYY-MM-DD_HH-MM-SS */
function fileStamp(iso) {
  return iso.slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function logError(dir, msg) {
  try {
    fs.appendFileSync(path.join(dir, '.capture-errors.log'), nowIso() + ' ' + msg + '\n');
  } catch (e) {
    /* nothing left to do */
  }
}

/**
 * Most recent model id in the session transcript. The transcript is written
 * asynchronously so it can lag; on the first prompt of a session there is no
 * assistant entry yet and this returns null.
 */
function modelFromTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  let model = null;
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim() || line.indexOf('"model"') === -1) continue;
      try {
        const o = JSON.parse(line);
        if (o && o.message && o.message.model && !o.isSidechain) model = o.message.model;
      } catch (e) {
        /* partial line mid-write */
      }
    }
  } catch (e) {
    return model;
  }
  return model;
}

/** Fallback: the last model recorded in our own log file. */
function modelFromLog(logPath) {
  try {
    const m = fs.readFileSync(logPath, 'utf8').match(/^model: (.+)$/gm);
    if (!m || !m.length) return null;
    const last = m[m.length - 1].slice('model: '.length).trim();
    return last && last !== 'unknown' ? last : null;
  } catch (e) {
    return null;
  }
}

/** Blocking sleep; the hook is a short-lived one-shot process. */
function sleepMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) {
    /* best effort */
  }
}

/**
 * The transcript is flushed asynchronously, so on the first turn of a session
 * the assistant entry carrying the model id may not have landed yet. Only when
 * we have no model at all do we wait for it, and only briefly.
 */
function resolveModel(transcriptPath, logPath, allowWait) {
  let model = modelFromTranscript(transcriptPath) || modelFromLog(logPath);
  if (!model && allowWait) {
    for (let i = 0; i < 15 && !model; i++) {
      sleepMs(200);
      model = modelFromTranscript(transcriptPath);
    }
  }
  return model || process.env.ANTHROPIC_MODEL || 'unknown';
}

function resolveAuthor(cwd) {
  if (process.env.AGENT_LOG_AUTHOR) return process.env.AGENT_LOG_AUTHOR;
  try {
    const cfg = path.join(cwd, '.claude', 'capture.config.json');
    if (fs.existsSync(cfg)) {
      const parsed = JSON.parse(fs.readFileSync(cfg, 'utf8'));
      if (parsed.author) return parsed.author;
    }
  } catch (e) {
    /* fall through */
  }
  try {
    return execFileSync('git', ['config', 'user.name'], { cwd, encoding: 'utf8' }).trim() || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Last assistant text for the turn, used only when the Stop payload does not
 * carry last_assistant_message.
 */
function responseFromTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let o;
      try {
        o = JSON.parse(lines[i]);
      } catch (e) {
        continue;
      }
      if (o.type !== 'assistant' || o.isSidechain || o.isMeta) continue;
      const content = o.message && o.message.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter(function (b) { return b && b.type === 'text' && b.text; })
        .map(function (b) { return b.text; })
        .join('\n')
        .trim();
      if (text) return text;
    }
  } catch (e) {
    return null;
  }
  return null;
}

/** Find this session's log file, or null if the session has not logged yet. */
function findLogFile(logDir, shortId) {
  try {
    const hit = fs
      .readdirSync(logDir)
      .filter(function (f) { return f.endsWith('_' + shortId + '.md'); })
      .sort();
    return hit.length ? path.join(logDir, hit[0]) : null;
  } catch (e) {
    return null;
  }
}

// Trailing \n? so the blank line after the closing --- is consumed on rewrite
// rather than accumulating on every append.
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n\n?/;

function buildFrontmatter(meta) {
  return [
    '---',
    'session_id: ' + meta.session_id,
    'date: ' + meta.date,
    'author: ' + meta.author,
    'model: ' + meta.model,
    'tool: ' + meta.tool,
    'project: ' + meta.project,
    'total_exchanges: ' + meta.total_exchanges,
    'first_prompt_time: ' + meta.first_prompt_time,
    'last_prompt_time: ' + meta.last_prompt_time,
    '---',
    '',
    '',
  ].join('\n');
}

function parseFrontmatter(text) {
  const m = text.match(FRONTMATTER_RE);
  if (!m) return null;
  const meta = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf(': ');
    if (idx > 0) meta[lines[i].slice(0, idx)] = lines[i].slice(idx + 2);
  }
  return meta;
}

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return;
  }

  const event = payload.hook_event_name;
  if (event !== 'UserPromptSubmit' && event !== 'Stop') return;

  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const logDir = path.join(cwd, '.agent-logs');
  fs.mkdirSync(logDir, { recursive: true });

  const sessionId = payload.session_id || 'unknown-session';
  const shortId = sessionId.slice(0, 8);

  let body = event === 'UserPromptSubmit' ? payload.prompt : payload.last_assistant_message;
  if (event === 'Stop' && (!body || !String(body).trim())) {
    body = responseFromTranscript(payload.transcript_path);
  }
  // An empty prompt is nothing to record; an empty response still gets an
  // entry so the turn is not silently missing from the log.
  if (event === 'UserPromptSubmit' && (!body || !String(body).trim())) return;
  if (!body || !String(body).trim()) body = '(no final assistant text for this turn)';
  body = String(body).replace(/\r\n/g, '\n').replace(/\s+$/, '');

  const ts = nowIso();
  let logPath = findLogFile(logDir, shortId);
  const model = resolveModel(payload.transcript_path, logPath || '', event === 'Stop');

  let meta;
  let content;

  if (!logPath) {
    logPath = path.join(logDir, fileStamp(ts) + '_' + shortId + '.md');
    meta = {
      session_id: sessionId,
      date: ts.slice(0, 10),
      author: resolveAuthor(cwd),
      model: model,
      tool: TOOL,
      project: path.basename(cwd),
      total_exchanges: 0,
      first_prompt_time: ts,
      last_prompt_time: ts,
    };
    content =
      '# Session Log - ' + meta.date + '\n\n' +
      'Session: `' + shortId + '` | Project: `' + meta.project + '` | Author: `' + meta.author + '`\n\n---\n\n';
  } else {
    const existing = fs.readFileSync(logPath, 'utf8');
    meta = parseFrontmatter(existing);
    if (!meta) throw new Error('log file missing frontmatter: ' + logPath);
    content = existing.replace(FRONTMATTER_RE, '');
  }

  const priorPrompts = (content.match(/^\[LOG_ENTRY type=PROMPT /gm) || []).length;
  const num = event === 'UserPromptSubmit' ? priorPrompts + 1 : Math.max(priorPrompts, 1);
  const type = event === 'UserPromptSubmit' ? 'PROMPT' : 'RESPONSE';

  content +=
    '[LOG_ENTRY type=' + type + ' num=' + num + ' session=' + shortId + ']\n' +
    'timestamp: ' + ts + '\n' +
    'model: ' + model + '\n\n' +
    body + '\n\n\n';

  meta.total_exchanges = event === 'UserPromptSubmit' ? num : priorPrompts;
  meta.last_prompt_time = ts;
  if (model !== 'unknown') meta.model = model;

  const tmp = logPath + '.tmp';
  fs.writeFileSync(tmp, buildFrontmatter(meta) + content);
  fs.renameSync(tmp, logPath);
}

try {
  main();
} catch (e) {
  try {
    const dir = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.agent-logs');
    fs.mkdirSync(dir, { recursive: true });
    logError(dir, String(e && e.stack ? e.stack : e).replace(/\n/g, ' | '));
  } catch (e2) {
    /* give up quietly rather than break the session */
  }
}
process.exit(0);
