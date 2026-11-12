/**
 * LoopBot playtest stats + feedback receiver (Google Apps Script, bound to a Google Sheet).
 * Setup steps are in scripts/telemetry/README.md.
 *
 * The game POSTs JSON as text/plain:
 *   { kind: 'events', id, version, platform, events: [{ type, floor, t, ... }] }
 *   { kind: 'feedback', version, platform, mood, floor, floorTitle, message }
 *   { kind: 'error', id, version, platform, message, where }
 * Events go to the "Events" tab, feedback to "Feedback" (and an email to FEEDBACK_EMAIL),
 * uncaught script errors from players' phones to "Errors".
 * "Floors" is a summary tab built by setup(): who tried each floor, who cleared it, who got stuck.
 */

var FEEDBACK_EMAIL = 'kisstudios98@gmail.com';
var EVENT_COLS = ['received', 'install', 'version', 'platform', 'clientTime', 'type', 'floor', 'result', 'stars', 'runs', 'hints', 'seconds', 'commands', 'steps', 'run', 'tier', 'free', 'cleared'];
var FEEDBACK_COLS = ['received', 'version', 'platform', 'mood', 'floor', 'floorTitle', 'message'];
var ERROR_COLS = ['received', 'install', 'version', 'platform', 'message', 'where'];
var TYPES = { session: 1, floor_start: 1, run: 1, hint: 1, floor_clear: 1, floor_leave: 1 };
var FLOORS = 50;

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Real payloads are a few KB; anything huge is someone poking at the public URL.
    if (!e.postData || e.postData.contents.length > 100000) return ContentService.createTextOutput('bad request');
    var body = JSON.parse(e.postData.contents);
    if (body.kind === 'events') saveEvents_(body);
    else if (body.kind === 'feedback') saveFeedback_(body);
    else if (body.kind === 'error') saveError_(body);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('bad request');
  } finally {
    lock.releaseLock();
  }
}

/** A quick check that the web app is up: open its URL in a browser. */
function doGet() {
  return ContentService.createTextOutput('LoopBot stats endpoint is running.');
}

// Text from players never starts with = + - @ (or a tab or line break before one), so the sheet,
// or Excel after a CSV download, never runs it as a formula.
function clean_(v, max) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  var s = String(v).slice(0, max || 64);
  return /^[\s]*[=+\-@]|^[\t\r]/.test(s) ? "'" + s : s;
}

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(cols);
    sh.setFrozenRows(1);
  }
  return sh;
}

function saveEvents_(body) {
  var events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
  var now = new Date();
  var rows = [];
  events.forEach(function (ev) {
    if (!ev || !TYPES[ev.type]) return;
    rows.push([
      now,
      clean_(body.id),
      clean_(body.version, 16),
      clean_(body.platform, 16),
      typeof ev.t === 'number' ? new Date(ev.t) : '',
      ev.type,
      clean_(ev.floor, 32),
      clean_(ev.result, 16),
      clean_(ev.stars),
      clean_(ev.runs),
      clean_(ev.hints),
      clean_(ev.seconds),
      clean_(ev.commands),
      clean_(ev.steps),
      clean_(ev.run),
      clean_(ev.tier),
      clean_(ev.free),
      clean_(ev.cleared),
    ]);
  });
  if (!rows.length) return;
  var sh = sheet_('Events', EVENT_COLS);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_COLS.length).setValues(rows);
}

function saveFeedback_(body) {
  var message = clean_(body.message, 2000);
  if (!message) return;
  var row = [new Date(), clean_(body.version, 16), clean_(body.platform, 16), clean_(body.mood, 16), clean_(body.floor, 32), clean_(body.floorTitle, 64), message];
  sheet_('Feedback', FEEDBACK_COLS).appendRow(row);
  try {
    MailApp.sendEmail(
      FEEDBACK_EMAIL,
      'LoopBot feedback: ' + row[3] + (row[4] ? ' on ' + row[5] + ' (' + row[4] + ')' : ''),
      message + '\n\n---\nVersion ' + row[1] + ' (' + row[2] + ')\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
    );
  } catch (err) {
    // Out of daily email quota: it is still in the sheet.
  }
}

function saveError_(body) {
  var message = clean_(body.message, 300);
  if (!message) return;
  sheet_('Errors', ERROR_COLS).appendRow([new Date(), clean_(body.id), clean_(body.version, 16), clean_(body.platform, 16), message, clean_(body.where, 200)]);
}

/** Run once from the editor: makes the Events, Feedback and Floors tabs. */
function setup() {
  sheet_('Events', EVENT_COLS);
  sheet_('Feedback', FEEDBACK_COLS);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Floors') || ss.insertSheet('Floors', 0);
  sh.clear();
  var head = ['floor', 'players tried', 'players cleared', 'players stuck', 'stuck %', 'avg runs to clear', 'avg minutes to clear', 'hints used', 'crashed runs', 'gave up visits'];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  sh.setFrozenRows(1);
  // Events columns: B install, F type, G floor, H result, J runs, L seconds, R cleared
  var rows = [];
  for (var i = 1; i <= FLOORS; i++) {
    var r = i + 1;
    var f = 'A' + r;
    rows.push([
      't1-f' + (i < 10 ? '0' : '') + i,
      '=IFERROR(COUNTUNIQUE(FILTER(Events!B:B, Events!F:F="floor_start", Events!G:G=' + f + ')), 0)',
      '=IFERROR(COUNTUNIQUE(FILTER(Events!B:B, Events!F:F="floor_clear", Events!G:G=' + f + ')), 0)',
      '=B' + r + '-C' + r,
      '=IF(B' + r + '=0, "", D' + r + '/B' + r + ')',
      '=IFERROR(AVERAGEIFS(Events!J:J, Events!F:F, "floor_clear", Events!G:G, ' + f + '), "")',
      '=IFERROR(AVERAGEIFS(Events!L:L, Events!F:F, "floor_clear", Events!G:G, ' + f + ')/60, "")',
      '=COUNTIFS(Events!F:F, "hint", Events!G:G, ' + f + ')',
      '=COUNTIFS(Events!F:F, "run", Events!G:G, ' + f + ', Events!H:H, "crashed")',
      '=COUNTIFS(Events!F:F, "floor_leave", Events!G:G, ' + f + ', Events!R:R, FALSE)',
    ]);
  }
  sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  sh.getRange(2, 5, rows.length, 1).setNumberFormat('0%');
  sh.getRange(2, 6, rows.length, 2).setNumberFormat('0.0');
  // The floors where the most players got stuck light up red.
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#ffffff', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMaxpointWithValue('#e67c73', SpreadsheetApp.InterpolationType.NUMBER, '0.6')
    .setRanges([sh.getRange(2, 5, rows.length, 1)])
    .build();
  sh.setConditionalFormatRules([rule]);
  sh.autoResizeColumns(1, head.length);
}
