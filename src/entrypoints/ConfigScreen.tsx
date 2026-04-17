import React, { useState } from 'react';
import { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import { Canvas, Button, TextField, SelectField } from 'datocms-react-ui';
import { Params } from '../types';

interface Props {
  ctx: RenderConfigScreenCtx;
}

const LANGUAGE_OPTIONS = [
  { label: 'Nederlands (NL)', value: 'NL' },
  { label: 'Engels (EN)', value: 'EN' },
  { label: 'Duits (DE)', value: 'DE' },
  { label: 'Frans (FR)', value: 'FR' },
];

export default function ConfigScreen({ ctx }: Props) {
  const saved = ctx.plugin.attributes.parameters as Params;

  const [icecatUsername, setIcecatUsername] = useState(saved.icecatUsername ?? '');
  const [language, setLanguage] = useState(saved.language ?? 'NL');
  const [productNameField, setProductNameField] = useState(saved.productNameField ?? '');
  const [brandField, setBrandField] = useState(saved.brandField ?? '');
  const [imageField, setImageField] = useState(saved.imageField ?? '');
  const [specsJsonField, setSpecsJsonField] = useState(saved.specsJsonField ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await ctx.updatePluginParameters({
      icecatUsername,
      language,
      productNameField,
      brandField,
      imageField,
      specsJsonField,
    });
    await ctx.notice('Instellingen opgeslagen.');
    setSaving(false);
  };

  return (
    <Canvas ctx={ctx}>
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>EAN Product Lookup — Instellingen</h2>

        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Icecat-verbinding</h3>
          <TextField
            id="icecatUsername"
            name="icecatUsername"
            label="Icecat gebruikersnaam"
            value={icecatUsername}
            onChange={setIcecatUsername}
            placeholder="bijv. mijnbedrijf"
            hint="Jouw Open Icecat of Full Icecat gebruikersnaam"
          />
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

        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>Veldkoppelingen</h3>
          <p style={{ fontSize: 12, color: '#666', marginTop: 0, marginBottom: 12 }}>
            Voer de API-sleutel in van het DatoCMS-veld dat gevuld moet worden.
            Laat leeg als je het veld nog niet hebt aangemaakt.
          </p>
          <TextField
            id="productNameField"
            name="productNameField"
            label="Productnaam veld (API-sleutel)"
            value={productNameField}
            onChange={setProductNameField}
            placeholder="bijv. product_naam"
          />
          <div style={{ marginTop: 12 }}>
            <TextField
              id="brandField"
              name="brandField"
              label="Merk veld (API-sleutel)"
              value={brandField}
              onChange={setBrandField}
              placeholder="bijv. merk"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <TextField
              id="imageField"
              name="imageField"
              label="Afbeelding URL veld (API-sleutel)"
              value={imageField}
              onChange={setImageField}
              placeholder="bijv. product_afbeelding_url"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <TextField
              id="specsJsonField"
              name="specsJsonField"
              label="Specificaties JSON veld (API-sleutel)"
              value={specsJsonField}
              onChange={setSpecsJsonField}
              placeholder="bijv. specificaties_json"
            />
          </div>
        </section>

        <Button onClick={handleSave} buttonType="primary" disabled={saving}>
          {saving ? 'Opslaan...' : 'Instellingen opslaan'}
        </Button>
      </div>
    </Canvas>
  );
}
