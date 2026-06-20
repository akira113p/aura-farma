import { Field, Input } from 'frontend';

export const CampoTexto = () => (
  <div style={{ padding: 16, maxWidth: 320 }}>
    <Field label="Nome do produto">
      <Input value="Amoxicilina 500mg" onChange={() => {}} placeholder="Ex.: Paracetamol 750mg" />
    </Field>
  </div>
);

export const CampoQuantidade = () => (
  <div style={{ padding: 16, maxWidth: 200 }}>
    <Field label="Estoque atual">
      <Input value="24" onChange={() => {}} type="number" />
    </Field>
  </div>
);

export const CampoVazio = () => (
  <div style={{ padding: 16, maxWidth: 320 }}>
    <Field label="Código SKU">
      <Input value="" onChange={() => {}} placeholder="Ex.: MED-0042" />
    </Field>
  </div>
);
