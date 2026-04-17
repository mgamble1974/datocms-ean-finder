import React, { useState } from 'react';
import { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import { Canvas, Button, TextField, SelectField, SwitchField } from 'datocms-react-ui';
import { Params, LogEntry } from '../types';
import { getLogs, clearLogs, formatTimestamp } from '../utils/logger';
import { CHANGELOG } from '../utils/changelog';

interface Props {
  ctx: RenderConfigScreenCtx;
}

const LANGUAGE_OPTIONS = [
  { label: 'Nederlands (NL)', value: 'NL' },
  { label: 'Engels (EN)', value: 'EN' },
  { label: 'Duits (DE)', value: 'DE' },
  { label: 'Frans (FR)', value: 'FR' },
];

type Tab = 'settings' | 'log' | 'changelog';

export default function ConfigScreen({ ctx }: Props) {
  const saved = ctx.plugin.attributes.parameters as Params;

  const [activeTab, setActiveTab] = useState<Tab>('settings');

  // Instellingen state
  const [enabled, setEnabled] = useState(saved.enabled ?? true);
  const [icecatUsername, setIcecatUsername] = useState(saved.icecatUsername ?? '');
  const [icecatApiKey, setIcecatApiKey] = useState(saved.icecatApiKey ?? '');
  const [language, setLanguage] = useState(saved.language ?? 'NL');
  const [productNameField, setProductNameField] = useState(saved.productNameField ?? '');
  const [brandField, setBrandField] = useState(saved.brandField ?? '');
  const [imageField, setImageField] = useState(saved.imageField ?? '');
  const [specsJsonField, setSpecsJsonField] = useState(saved.specsJsonField ?? '');
  const [saving, setSaving] = useState(false);

  // Log state
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs());
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Detecteer wijzigingen t.o.v. opgeslagen waarden
  const isDirty =
    enabled !== (saved.enabled ?? true) ||
    icecatUsername !== (saved.icecatUsername ?? '') ||
    icecatApiKey !== (saved.icecatApiKey ?? '') ||
    language !== (saved.language ?? 'NL') ||
    productNameField !== (saved.productNameField ?? '') ||
    brandField !== (saved.brandField ?? '') ||
    imageField !== (saved.imageField ?? '') ||
    specsJsonField !== (saved.specsJsonField ?? '');

  const handleSave = async () => {
    setSaving(true);
    await ctx.updatePluginParameters({
      enabled,
      icecatUsername,
      icecatApiKey,
      language,
      productNameField,
      brandField,
      imageField,
      specsJsonField,
    });
    await ctx.notice('Instellingen opgeslagen.');
    setSaving(false);
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
    setExpandedRow(null);
  };

  const refreshLogs = () => {
    setLogs(getLogs());
    setExpandedRow(null);
  };

  const toggleRow = (i: number) => setExpandedRow(prev => prev === i ? null : i);

  const statusColor: Record<string, string> = {
    success: '#16a34a',
    not_found: '#d97706',
    error: '#dc2626',
  };

  const statusLabel: Record<string, string> = {
    success: 'Gevonden',
    not_found: 'Niet gevonden',
    error: 'Fout',
  };

  return (
    <Canvas ctx={ctx}>
      <div style={{ maxWidth: 700 }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>EAN Product Lookup</h2>

        {/* Tabbladbalk */}
        <div style={s.tabBar}>
          {(['settings', 'log', 'changelog'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
            >
              {tab === 'settings' && (isDirty ? '● Instellingen' : 'Instellingen')}
              {tab === 'log' && `Activiteitenlog (${logs.length})`}
              {tab === 'changelog' && 'Changelog'}
            </button>
          ))}
        </div>

        {/* ── Tab: Instellingen ── */}
        {activeTab === 'settings' && (
          <div style={s.tabContent}>

            <section style={s.section}>
              <SwitchField
                id="enabled"
                name="enabled"
                label="Plugin ingeschakeld"
                hint="Schakel de EAN-zoekfunctie in of uit voor alle records."
                value={enabled}
                onChange={setEnabled}
              />
            </section>

            <section style={s.section}>
              <h3 style={s.sectionTitle}>Icecat-verbinding</h3>
              <TextField
                id="icecatUsername"
                name="icecatUsername"
                label="Gebruikersnaam"
                value={icecatUsername}
                onChange={setIcecatUsername}
                placeholder="bijv. mijnbedrijf"
                hint="Jouw Open Icecat of Full Icecat gebruikersnaam"
              />
              <div style={{ marginTop: 12 }}>
                <TextField
                  id="icecatApiKey"
                  name="icecatApiKey"
                  label="API-sleutel"
                  value={icecatApiKey}
                  onChange={setIcecatApiKey}
                  placeholder="Jouw Icecat wachtwoord of API-sleutel"
                  hint="Wordt gebruikt voor authenticatie (Basic Auth). Laat leeg voor Open Icecat."
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <SelectField
                  id="language"
                  name="language"
                  label="Taal voor productgegevens"
                  value={{ label: LANGUAGE_OPTIONS.find(o => o.value === language)?.label ?? language, value: language }}
                  selectInputProps={{ options: LANGUAGE_OPTIONS }}
                  onChange={(opt) => setLanguage((opt as { value: string }).value ?? 'NL')}
                />
              </div>
            </section>

            <section style={s.section}>
              <h3 style={s.sectionTitle}>Veldkoppelingen</h3>
              <p style={s.hint}>
                Vul de API-sleutel in van het DatoCMS-veld dat gevuld moet worden.
                Laat leeg als het veld nog niet bestaat.
              </p>
              <TextField
                id="productNameField"
                name="productNameField"
                label="Productnaam"
                value={productNameField}
                onChange={setProductNameField}
                placeholder="bijv. product_naam"
              />
              <div style={{ marginTop: 12 }}>
                <TextField
                  id="brandField"
                  name="brandField"
                  label="Merk"
                  value={brandField}
                  onChange={setBrandField}
                  placeholder="bijv. merk"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <TextField
                  id="imageField"
                  name="imageField"
                  label="Afbeelding URL"
                  value={imageField}
                  onChange={setImageField}
                  placeholder="bijv. product_afbeelding_url"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <TextField
                  id="specsJsonField"
                  name="specsJsonField"
                  label="Specificaties (JSON)"
                  value={specsJsonField}
                  onChange={setSpecsJsonField}
                  placeholder="bijv. specificaties_json"
                />
              </div>
            </section>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                onClick={handleSave}
                buttonType="primary"
                disabled={saving || !isDirty}
              >
                {saving ? 'Opslaan…' : 'Instellingen opslaan'}
              </Button>
              {!isDirty && (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Geen wijzigingen</span>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Activiteitenlog ── */}
        {activeTab === 'log' && (
          <div style={s.tabContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#555' }}>
                {logs.length === 0
                  ? 'Nog geen zoekopdrachten vastgelegd.'
                  : `${logs.length} registratie(s) — klik op een rij voor details.`}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={refreshLogs} buttonSize="xxs">Vernieuwen</Button>
                {logs.length > 0 && (
                  <Button onClick={handleClearLogs} buttonSize="xxs" buttonType="negative">
                    Log leegmaken
                  </Button>
                )}
              </div>
            </div>

            {logs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.logTable}>
                  <thead>
                    <tr>
                      <th style={s.th}></th>
                      <th style={s.th}>Tijdstip</th>
                      <th style={s.th}>EAN-code</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}>HTTP</th>
                      <th style={s.th}>ms</th>
                      <th style={s.th}>Auth</th>
                      <th style={s.th}>Product / Fout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((entry, i) => (
                      <React.Fragment key={i}>
                        <tr
                          style={{
                            ...(i % 2 === 0 ? s.trEven : s.trOdd),
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleRow(i)}
                        >
                          <td style={{ ...s.td, color: '#9ca3af', userSelect: 'none' }}>
                            {expandedRow === i ? '▾' : '▸'}
                          </td>
                          <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                            {formatTimestamp(entry.timestamp)}
                          </td>
                          <td style={{ ...s.td, fontFamily: 'monospace' }}>{entry.ean}</td>
                          <td style={{ ...s.td, color: statusColor[entry.status], fontWeight: 600 }}>
                            {statusLabel[entry.status]}
                          </td>
                          <td style={s.td}>{entry.httpStatus ?? '—'}</td>
                          <td style={s.td}>{entry.durationMs}</td>
                          <td style={{ ...s.td, color: '#6b7280' }}>
                            {entry.authMethod === 'basic' ? 'Basic' : 'Geen'}
                          </td>
                          <td style={{ ...s.td, color: entry.status === 'error' ? '#dc2626' : '#374151' }}>
                            {entry.productTitle ?? entry.errorMessage ?? '—'}
                          </td>
                        </tr>

                        {expandedRow === i && (
                          <tr style={{ background: '#f0f9ff' }}>
                            <td colSpan={8} style={{ padding: '10px 12px' }}>
                              <LogDetail entry={entry} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Changelog ── */}
        {activeTab === 'changelog' && (
          <div style={s.tabContent}>
            {CHANGELOG.map((entry) => (
              <div key={entry.version} style={s.changelogEntry}>
                <div style={s.changelogHeader}>
                  <span style={s.changelogVersion}>v{entry.version}</span>
                  <span style={s.changelogDate}>
                    {new Date(entry.date).toLocaleDateString('nl-NL', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <ul style={s.changelogList}>
                  {entry.changes.map((change, i) => (
                    <li key={i} style={s.changelogItem}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Canvas>
  );
}

function LogDetail({ entry }: { entry: LogEntry }) {
  const rows: [string, string | number | undefined][] = [
    ['Tijdstip', entry.timestamp],
    ['EAN-code', entry.ean],
    ['Status', entry.status],
    ['HTTP-statuscode', entry.httpStatus],
    ['Responstijd', entry.durationMs !== undefined ? `${entry.durationMs} ms` : undefined],
    ['Authenticatie', entry.authMethod === 'basic' ? 'Basic Auth (gebruikersnaam + API-sleutel)' : 'Geen (Open Icecat)'],
    ['Request URL', entry.requestUrl],
    ['Icecat-bericht', entry.icecatMessage],
    ['Icecat product-ID', entry.icecatProductId],
    ['Productnaam', entry.productTitle],
    ['Foutmelding', entry.errorMessage],
    ['Response samenvatting', entry.responseBodySummary],
  ];

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
      <tbody>
        {rows.map(([label, value]) =>
          value !== undefined && value !== null && value !== '' ? (
            <tr key={label}>
              <td style={{ padding: '2px 8px 2px 0', color: '#6b7280', whiteSpace: 'nowrap', verticalAlign: 'top', width: 180 }}>
                {label}
              </td>
              <td style={{ padding: '2px 0', wordBreak: 'break-all', fontFamily: label === 'Request URL' || label === 'Response samenvatting' ? 'monospace' : undefined }}>
                {String(value)}
              </td>
            </tr>
          ) : null
        )}
      </tbody>
    </table>
  );
}

const s: Record<string, React.CSSProperties> = {
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '2px solid #e5e7eb',
    marginBottom: 0,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabBtnActive: {
    color: '#111827',
    borderBottomColor: '#111827',
  },
  tabContent: {
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: '1px solid #f3f4f6',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 12,
    color: '#374151',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 0,
    marginBottom: 12,
  },
  logTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 600,
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '5px 8px',
    fontSize: 12,
    verticalAlign: 'top',
  },
  trEven: {
    background: '#ffffff',
  },
  trOdd: {
    background: '#f9fafb',
  },
  changelogEntry: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: '1px solid #f3f4f6',
  },
  changelogHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 8,
  },
  changelogVersion: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
  },
  changelogDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  changelogList: {
    margin: 0,
    paddingLeft: 18,
  },
  changelogItem: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 1.5,
  },
};
