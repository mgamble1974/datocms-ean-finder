import React, { useState } from 'react';
import { RenderItemFormSidebarPanelCtx } from 'datocms-plugin-sdk';
import { Canvas, Button, TextField, Spinner } from 'datocms-react-ui';
import { IcecatProduct, IcecatFeatureGroup, IcecatResponse, Params } from '../types';
import { addLogEntry } from '../utils/logger';
import pkg from '../../package.json';

interface Props {
  ctx: RenderItemFormSidebarPanelCtx;
}

type StepStatus = 'ok' | 'info' | 'warn' | 'error';

interface LogStep {
  label: string;
  value?: string;
  status: StepStatus;
}

interface CallLog {
  steps: LogStep[];
  outcome: 'success' | 'not_found' | 'error';
  durationMs: number;
}

export default function SidebarPanel({ ctx }: Props) {
  const params = ctx.plugin.attributes.parameters as Params;
  const [ean, setEan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<IcecatProduct | null>(null);
  const [callLog, setCallLog] = useState<CallLog | null>(null);

  // Plugin uitgeschakeld
  if (params.enabled === false) {
    return (
      <Canvas ctx={ctx}>
        <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>
          De EAN-zoekfunctie is uitgeschakeld. Schakel de plug-in in via de instellingen.
        </div>
      </Canvas>
    );
  }

  const handleLookup = async () => {
    const trimmed = ean.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setProduct(null);
    setCallLog(null);

    const steps: LogStep[] = [];
    const t0 = Date.now();

    const step = (label: string, value: string | undefined, status: StepStatus) => {
      steps.push({ label, value, status });
    };

    try {
      // Stap 1: EAN-validatie
      const isValidEan = /^\d{8}$|^\d{13}$/.test(trimmed);
      step('EAN-code', trimmed, isValidEan ? 'ok' : 'warn');
      if (!isValidEan) {
        step('Waarschuwing', 'EAN is niet 8 of 13 cijfers — toch doorgaan', 'warn');
      }

      // Stap 2: Gebruikersnaam check
      if (!params.icecatUsername) {
        step('Icecat gebruikersnaam', 'Niet ingesteld', 'error');
        step('Gestopt', 'Stel een gebruikersnaam in via de plug-in instellingen', 'error');
        setError('Configureer eerst een Icecat gebruikersnaam in de plug-in instellingen.');
        setCallLog({ steps, outcome: 'error', durationMs: Date.now() - t0 });
        return;
      }
      step('Icecat gebruikersnaam', params.icecatUsername, 'ok');

      // Stap 3: Auth-methode
      const useBasicAuth = !!(params.icecatUsername && params.icecatApiKey);
      const authMethod: 'none' | 'basic' = useBasicAuth ? 'basic' : 'none';
      step(
        'Authenticatie',
        useBasicAuth ? 'Basic Auth (gebruikersnaam + API-sleutel)' : 'Geen — Open Icecat modus',
        'info'
      );

      // Stap 4: URL opbouwen
      const lang = params.language ?? 'NL';
      const requestUrl =
        `https://live.icecat.us/api` +
        `?UserName=${encodeURIComponent(params.icecatUsername)}` +
        `&Language=${lang}` +
        `&Content=` +
        `&ean=${encodeURIComponent(trimmed)}`;
      step('Taal', lang, 'info');
      step('Request URL', requestUrl, 'info');

      // Stap 5: Request verzenden
      const headers: HeadersInit = {};
      if (useBasicAuth) {
        headers['Authorization'] = `Basic ${btoa(`${params.icecatUsername}:${params.icecatApiKey}`)}`;
      }
      step('Verzoek verzonden', new Date().toLocaleTimeString('nl-NL'), 'info');

      const res = await fetch(requestUrl, { headers });
      const durationMs = Date.now() - t0;

      step(
        'HTTP-response',
        `${res.status} ${res.statusText} — ${durationMs}ms`,
        res.ok ? 'ok' : 'error'
      );

      // Stap 6: Body lezen
      let json: IcecatResponse | null = null;
      let rawBodySummary: string | undefined;
      try {
        const text = await res.text();
        rawBodySummary = text.length > 400 ? text.slice(0, 400) + '…' : text;
        json = JSON.parse(text) as IcecatResponse;
        step('Response body', 'Geldige JSON ontvangen', 'ok');
      } catch {
        step('Response body', 'Geen geldige JSON — onverwacht formaat', 'error');
      }

      if (json?.msg) {
        step('Icecat-melding', json.msg, res.ok ? 'info' : 'error');
      }

      // Stap 7: HTTP-fout
      if (!res.ok) {
        step('Resultaat', `Verzoek mislukt met HTTP ${res.status}`, 'error');
        if (rawBodySummary) step('Response inhoud', rawBodySummary, 'error');

        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'error',
          durationMs,
          httpStatus: res.status,
          requestUrl,
          authMethod,
          errorMessage: `HTTP ${res.status}${json?.msg ? ` — ${json.msg}` : ''}`,
          responseBodySummary: rawBodySummary,
        });

        setError(`Verzoek mislukt: HTTP ${res.status}${json?.msg ? ` — ${json.msg}` : ''}`);
        setCallLog({ steps, outcome: 'error', durationMs });
        return;
      }

      // Stap 8: Product niet gevonden
      if (!json?.data) {
        step('Productdata', 'Geen product gevonden voor deze EAN', 'warn');
        if (rawBodySummary) step('Response inhoud', rawBodySummary, 'warn');

        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'not_found',
          durationMs,
          httpStatus: res.status,
          requestUrl,
          authMethod,
          icecatMessage: json?.msg,
          responseBodySummary: rawBodySummary,
        });

        setError(`Geen product gevonden voor EAN: ${trimmed}${json?.msg ? ` (${json.msg})` : ''}`);
        setCallLog({ steps, outcome: 'not_found', durationMs });
        return;
      }

      // Stap 9: Succes
      const specCount = json.data.FeaturesGroups?.reduce((n, g) => n + g.Features.length, 0) ?? 0;
      const groupCount = json.data.FeaturesGroups?.length ?? 0;
      step('Product gevonden', `${json.data.GeneralInfo.Title} (${json.data.GeneralInfo.Brand})`, 'ok');
      step('Icecat product-ID', String(json.data.GeneralInfo.IcecatId ?? '—'), 'info');
      step('Specificaties', `${specCount} kenmerken in ${groupCount} groepen`, 'info');
      if (json.data.GeneralInfo.Image?.HighImg) {
        step('Afbeelding', json.data.GeneralInfo.Image.HighImg, 'ok');
      } else {
        step('Afbeelding', 'Geen afbeelding beschikbaar', 'warn');
      }

      addLogEntry({
        timestamp: new Date().toISOString(),
        ean: trimmed,
        status: 'success',
        durationMs,
        httpStatus: res.status,
        requestUrl,
        authMethod,
        productTitle: json.data.GeneralInfo.Title,
        icecatProductId: json.data.GeneralInfo.IcecatId,
        icecatMessage: json.msg,
        responseBodySummary: `Gevonden: "${json.data.GeneralInfo.Title}" (${json.data.GeneralInfo.Brand}) — ${specCount} specificaties in ${groupCount} groepen`,
      });

      setProduct(json.data);
      setCallLog({ steps, outcome: 'success', durationMs });

    } catch (err) {
      const durationMs = Date.now() - t0;
      const message = err instanceof Error ? err.message : 'Onbekende fout';

      // Alleen loggen als er geen HTTP-fout al is gelogd
      if (!message.startsWith('HTTP ')) {
        step('Netwerkfout', message, 'error');
        step('Mogelijke oorzaak', 'Netwerkprobleem, CORS-blokkering of ongeldige URL', 'error');

        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'error',
          durationMs,
          errorMessage: message,
          responseBodySummary: 'Netwerkfout of CORS-probleem — geen response ontvangen',
        });
      }

      setError('Fout bij ophalen productdata. Bekijk de debug-log hieronder voor details.');
      setCallLog({ steps, outcome: 'error', durationMs });
    } finally {
      setLoading(false);
    }
  };

  const applyToField = async (fieldKey: string | undefined, value: string) => {
    if (!fieldKey) {
      await ctx.alert('Dit veld is niet gekoppeld. Stel de veld-API-sleutel in via de plug-in instellingen.');
      return;
    }
    await ctx.setFieldValue(fieldKey, value);
    ctx.notice(`Veld "${fieldKey}" bijgewerkt.`);
  };

  const buildSpecsJson = (groups: IcecatFeatureGroup[]): Record<string, Record<string, string>> => {
    const result: Record<string, Record<string, string>> = {};
    for (const group of groups) {
      result[group.FeatureGroup.Name] = {};
      for (const feat of group.Features) {
        result[group.FeatureGroup.Name][feat.Feature.Name] = feat.PresentationValue;
      }
    }
    return result;
  };

  const imageUrl = product?.GeneralInfo?.Image?.HighImg ?? product?.GeneralInfo?.Image?.LowImg;

  return (
    <Canvas ctx={ctx}>
      <div style={{ padding: '8px 0' }}>

        {/* EAN invoer */}
        <TextField
          id="ean"
          name="ean"
          label="EAN-code"
          value={ean}
          onChange={setEan}
          placeholder="bijv. 8712581631995"
          hint="8 of 13 cijfers — druk op Enter om te zoeken"
          textInputProps={{
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !loading && ean.trim()) {
                e.preventDefault();
                handleLookup();
              }
            },
          }}
        />
        <div style={{ marginTop: 8 }}>
          <Button
            onClick={handleLookup}
            buttonType="primary"
            disabled={loading || !ean.trim()}
            fullWidth
          >
            {loading ? 'Zoeken…' : 'Productgegevens ophalen'}
          </Button>
        </div>

        {/* Laden */}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Spinner />
          </div>
        )}

        {/* Foutmelding */}
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Debug-log */}
        {callLog && (
          <details style={styles.debugPanel} open={callLog.outcome !== 'success'}>
            <summary style={styles.debugSummary}>
              <span style={{ color: callLog.outcome === 'success' ? '#16a34a' : callLog.outcome === 'not_found' ? '#d97706' : '#dc2626' }}>
                {callLog.outcome === 'success' ? '✓' : callLog.outcome === 'not_found' ? '○' : '✕'}
              </span>
              {' '}Debug-log
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
                ({callLog.durationMs}ms)
              </span>
            </summary>
            <div style={styles.debugBody}>
              {callLog.steps.map((s, i) => (
                <div key={i} style={styles.debugStep}>
                  <span style={{ ...styles.debugIcon, color: stepColor(s.status) }}>
                    {stepIcon(s.status)}
                  </span>
                  <span style={styles.debugLabel}>{s.label}</span>
                  {s.value && (
                    <span style={{
                      ...styles.debugValue,
                      color: stepColor(s.status),
                      wordBreak: s.value.startsWith('http') ? 'break-all' : 'normal',
                      fontFamily: s.value.startsWith('http') ? 'monospace' : undefined,
                    }}>
                      {s.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Resultaten */}
        {product && (
          <div style={{ marginTop: 16 }}>

            {/* Productafbeelding */}
            {imageUrl && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img
                  src={imageUrl}
                  alt={product.GeneralInfo.Title}
                  style={{ maxWidth: '100%', maxHeight: 130, objectFit: 'contain' }}
                />
              </div>
            )}

            {/* Productnaam */}
            <FieldRow
              label="Productnaam"
              value={product.GeneralInfo.Title}
              configured={!!params.productNameField}
              onApply={() => applyToField(params.productNameField, product!.GeneralInfo.Title)}
            />

            {/* Merk */}
            <FieldRow
              label="Merk"
              value={product.GeneralInfo.Brand}
              configured={!!params.brandField}
              onApply={() => applyToField(params.brandField, product!.GeneralInfo.Brand)}
            />

            {/* Artikelnummer fabrikant */}
            {product.GeneralInfo.BrandPartCode && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Artikelnr. fabrikant</span>
                <span style={styles.infoValue}>{product.GeneralInfo.BrandPartCode}</span>
              </div>
            )}

            {/* Afbeelding URL */}
            {imageUrl && (
              <FieldRow
                label="Afbeelding URL"
                value={imageUrl}
                configured={!!params.imageField}
                onApply={() => applyToField(params.imageField, imageUrl)}
                truncate
              />
            )}

            {/* Korte beschrijving */}
            {product.GeneralInfo.Description?.ShortDesc && (
              <div style={{ ...styles.infoRow, marginBottom: 12 }}>
                <span style={styles.infoLabel}>Korte omschrijving</span>
                <span style={{ ...styles.infoValue, fontStyle: 'italic' }}>
                  {product.GeneralInfo.Description.ShortDesc}
                </span>
              </div>
            )}

            {/* Specificaties */}
            {product.FeaturesGroups && product.FeaturesGroups.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={styles.sectionHeader}>Specificaties</div>

                <div style={{ marginBottom: 8 }}>
                  <Button
                    onClick={() => {
                      const json = JSON.stringify(
                        buildSpecsJson(product.FeaturesGroups!),
                        null,
                        2
                      );
                      applyToField(params.specsJsonField, json);
                    }}
                    buttonSize="xxs"
                    disabled={!params.specsJsonField}
                  >
                    Alle specs naar JSON-veld
                  </Button>
                </div>

                {product.FeaturesGroups.map((group, gi) => (
                  <details key={gi} style={{ marginBottom: 4 }}>
                    <summary style={styles.groupSummary}>
                      {group.FeatureGroup.Name}
                      <span style={styles.groupCount}>({group.Features.length})</span>
                    </summary>
                    <table style={styles.specsTable}>
                      <tbody>
                        {group.Features.map((feat, fi) => (
                          <tr key={fi} style={styles.specsRow}>
                            <td style={styles.specsName}>{feat.Feature.Name}</td>
                            <td style={styles.specsValue}>{feat.PresentationValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Versie-indicator */}
        <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #f0f0f0', fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
          EAN Product Lookup v{pkg.version}
        </div>
      </div>
    </Canvas>
  );
}

function FieldRow({
  label,
  value,
  configured,
  onApply,
  truncate = false,
}: {
  label: string;
  value: string;
  configured: boolean;
  onApply: () => void;
  truncate?: boolean;
}) {
  return (
    <div style={styles.fieldRow}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={{
        ...styles.infoValue,
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <Button
        onClick={onApply}
        buttonSize="xxs"
        disabled={!configured}
      >
        Toepassen in record
      </Button>
    </div>
  );
}

function stepIcon(status: StepStatus): string {
  switch (status) {
    case 'ok':   return '✓';
    case 'info': return '·';
    case 'warn': return '⚠';
    case 'error': return '✕';
  }
}

function stepColor(status: StepStatus): string {
  switch (status) {
    case 'ok':   return '#16a34a';
    case 'info': return '#6b7280';
    case 'warn': return '#d97706';
    case 'error': return '#dc2626';
  }
}

const styles: Record<string, React.CSSProperties> = {
  error: {
    marginTop: 12,
    padding: '8px 10px',
    background: '#fdf0ef',
    border: '1px solid #f5c6c2',
    borderRadius: 4,
    color: '#c0392b',
    fontSize: 12,
  },
  fieldRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: '1px solid #eee',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  infoValue: {
    fontSize: 13,
    color: '#222',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: '#444',
    marginBottom: 8,
    paddingTop: 4,
    borderTop: '1px solid #eee',
  },
  groupSummary: {
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '3px 0',
    userSelect: 'none',
  },
  groupCount: {
    fontWeight: 400,
    color: '#888',
    marginLeft: 4,
  },
  specsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 4,
    marginBottom: 4,
  },
  specsRow: {
    borderBottom: '1px solid #f5f5f5',
  },
  specsName: {
    padding: '3px 4px',
    fontSize: 11,
    color: '#555',
    verticalAlign: 'top',
    width: '50%',
  },
  specsValue: {
    padding: '3px 4px',
    fontSize: 11,
    fontWeight: 500,
    verticalAlign: 'top',
  },
  debugPanel: {
    marginTop: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: 11,
    background: '#fafafa',
  },
  debugSummary: {
    padding: '6px 8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 11,
    userSelect: 'none',
    listStyle: 'none',
  },
  debugBody: {
    borderTop: '1px solid #e5e7eb',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  debugStep: {
    display: 'grid',
    gridTemplateColumns: '12px 120px 1fr',
    gap: 4,
    alignItems: 'baseline',
    lineHeight: 1.5,
  },
  debugIcon: {
    fontWeight: 700,
    fontSize: 10,
    textAlign: 'center',
  },
  debugLabel: {
    color: '#374151',
    fontWeight: 500,
  },
  debugValue: {
    fontSize: 11,
  },
};
