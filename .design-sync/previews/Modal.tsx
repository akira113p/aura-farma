import { Modal, Button } from 'frontend';

export const Aberto = () => (
  <div style={{ position: 'relative', minHeight: 280 }}>
    <Modal
      open={true}
      onClose={() => {}}
      title="Confirmar exclusão"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button kind="ghost" onClick={() => {}}>Cancelar</Button>
          <Button kind="danger" onClick={() => {}}>Excluir</Button>
        </div>
      }
    >
      <p style={{ margin: 0 }}>Tem certeza que deseja remover <strong>Amoxicilina 500mg</strong> do estoque? Esta ação não pode ser desfeita.</p>
    </Modal>
  </div>
);

export const ComFormulario = () => (
  <div style={{ position: 'relative', minHeight: 320 }}>
    <Modal
      open={true}
      onClose={() => {}}
      title="Registrar venda"
      footer={
        <Button kind="primary" onClick={() => {}}>Confirmar venda</Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
          3 itens · Total: R$ 84,50
        </p>
        <Button kind="secondary" onClick={() => {}}>Adicionar item</Button>
      </div>
    </Modal>
  </div>
);
