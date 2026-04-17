import React, { useState } from 'react';
import { RenderItemFormSidebarPanelCtx } from 'datocms-plugin-sdk';
import { Canvas, Button, TextField, Spinner } from 'datocms-react-ui';
import { IcecatProduct, IcecatFeatureGroup, IcecatResponse, Params } from '../types';
import { addLogEntry } from '../utils/logger';

interface Props {
  ctx: RenderItemFormSidebarPanelCtx;
}

export default function SidebarPanel({ ctx }: Props) {
  const params = ctx.plugin.attributes.parameters as Params;
  const [ean, setEan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<IcecatProduct | null>(null);

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

    if (!params.icecatUsername) {
      setError('Configureer eerst een Icecat gebruikersnaam in de plug-in instellingen.');
      return;
    }

    setLoading(true);
    setError(null);
    setProduct(null);

    const t0 = Date.now();

    try {
      const lang = params.language ?? 'NL';
      const url =
        `https://live.icecat.us/api` +
        `?UserName=${encodeURIComponent(params.icecatUsername)}` +
        `&Language=${lang}` +
        `&Content=` +
        `&ean=${encodeURIComponent(trimmed)}`;

      const headers: HeadersInit = {};
      if (params.icecatUsername && params.icecatApiKey) {
        headers['Authorization'] = `Basic ${btoa(`${params.icecatUsername}:${params.icecatApiKey}`)}`;
      }

      const res = await fetch(url, { headers });
      const durationMs = Date.now() - t0;

      if (!res.ok) {
        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'error',
          durationMs,
          httpStatus: res.status,
          errorMessage: `HTTP ${res.status}`,
        });
        throw new Error(`HTTP ${res.status}`);
      }

      const json: IcecatResponse = await res.json();

      if (!json.data) {
        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'not_found',
          durationMs,
          httpStatus: res.status,
        });
        setError(`Geen product gevonden voor EAN: ${trimmed}`);
      } else {
        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'success',
          durationMs,
          httpStatus: res.status,
          productTitle: json.data.GeneralInfo.Title,
        });
        setProduct(json.data);
      }
    } catch (err) {
      const durationMs = Date.now() - t0;
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      if (!error) {
        addLogEntry({
          timestamp: new Date().toISOString(),
          ean: trimmed,
          status: 'error',
          durationMs,
          errorMessage: message,
        });
      }
      setError('Fout bij ophalen productdata. Controleer de gebruikersnaam en internetverbinding.');
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
          hint="8 of 13 cijfers"
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
};
